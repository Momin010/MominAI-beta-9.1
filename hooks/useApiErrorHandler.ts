// hooks/useApiErrorHandler.ts - API Error Handling Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  APIErrorDetails,
  NetworkErrorDetails
} from '../types';
import {
  createAppError,
  createErrorContext,
  logError,
  getRecoveryStrategy,
  classifyNetworkError,
  classifyAPIError
} from '../utils/errorUtils';

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};

// Request tracking
interface RequestTracker {
  id: string;
  url: string;
  method: string;
  startTime: number;
  retryCount: number;
  abortController?: AbortController;
}

// API Error Handler Hook
export const useApiErrorHandler = () => {
  const activeRequests = useRef<Map<string, RequestTracker>>(new Map());
  const retryTimeouts = useRef<Map<string, number>>(new Map());

  // Generate request ID
  const generateRequestId = useCallback((): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Track request start
  const trackRequestStart = useCallback((requestId: string, url: string, method: string) => {
    const tracker: RequestTracker = {
      id: requestId,
      url,
      method,
      startTime: Date.now(),
      retryCount: 0,
      abortController: new AbortController()
    };
    activeRequests.current.set(requestId, tracker);
  }, []);

  // Track request end
  const trackRequestEnd = useCallback((requestId: string) => {
    const tracker = activeRequests.current.get(requestId);
    if (tracker) {
      activeRequests.current.delete(requestId);
      // Clean up abort controller
      if (tracker.abortController) {
        tracker.abortController.abort();
      }
    }
  }, []);

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((retryCount: number, config: RetryConfig): number => {
    const delay = config.baseDelay * Math.pow(config.backoffFactor, retryCount);
    return Math.min(delay, config.maxDelay);
  }, []);

  // Check if request should be retried
  const shouldRetryRequest = useCallback((error: AppError, retryCount: number, config: RetryConfig): boolean => {
    if (retryCount >= config.maxRetries) return false;
    if (!error.retryable) return false;

    // Don't retry certain types of errors
    switch (error.category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
      case ErrorCategory.VALIDATION:
        return false;
      case ErrorCategory.API:
        // Don't retry 4xx errors except 429 (rate limit)
        const details = error.context.metadata as APIErrorDetails;
        if (details?.statusCode && details.statusCode >= 400 && details.statusCode < 500 && details.statusCode !== 429) {
          return false;
        }
        return true;
      default:
        return true;
    }
  }, []);

  // Execute retry with delay
  const executeRetry = useCallback((
    requestId: string,
    retryFn: () => Promise<any>,
    retryCount: number,
    config: RetryConfig,
    onRetry?: (attempt: number) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const delay = calculateRetryDelay(retryCount, config);

      const timeoutId = window.setTimeout(async () => {
        try {
          retryTimeouts.current.delete(requestId);
          onRetry?.(retryCount + 1);

          const result = await retryFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      retryTimeouts.current.set(requestId, timeoutId);
    });
  }, [calculateRetryDelay]);

  // Cancel retry
  const cancelRetry = useCallback((requestId: string) => {
    const timeoutId = retryTimeouts.current.get(requestId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      retryTimeouts.current.delete(requestId);
    }
  }, []);

  // Cancel request
  const cancelRequest = useCallback((requestId: string) => {
    const tracker = activeRequests.current.get(requestId);
    if (tracker?.abortController) {
      tracker.abortController.abort();
    }
    trackRequestEnd(requestId);
    cancelRetry(requestId);
  }, [trackRequestEnd, cancelRetry]);

  // Enhanced fetch with error handling
  const apiRequest = useCallback(async <T = any>(
    url: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> => {
    const config = { ...defaultRetryConfig, ...retryConfig };
    const requestId = generateRequestId();
    const method = options.method || 'GET';

    trackRequestStart(requestId, url, method);

    const makeRequest = async (): Promise<T> => {
      try {
        const tracker = activeRequests.current.get(requestId);
        const response = await fetch(url, {
          ...options,
          signal: tracker?.abortController?.signal
        });

        const trackerAfter = activeRequests.current.get(requestId);
        if (trackerAfter) {
          trackerAfter.retryCount++;
        }

        // Handle HTTP errors
        if (!response.ok) {
          const errorDetails: APIErrorDetails = {
            endpoint: url,
            method,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries())
          };

          // Try to get response body for error details
          try {
            const responseBody = await response.text();
            if (responseBody) {
              try {
                errorDetails.responseBody = JSON.parse(responseBody);
              } catch {
                errorDetails.responseBody = responseBody;
              }
            }
          } catch {
            // Ignore errors when trying to read response body
          }

          const error = createAppError(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            createErrorContext('API', 'http_request', {
              requestId,
              url,
              method,
              statusCode: response.status,
              apiDetails: errorDetails
            })
          );

          throw error;
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text() as any;
        }

      } catch (error: any) {
        // Handle network errors
        if (error.name === 'AbortError') {
          const abortError = createAppError(
            new Error('Request was cancelled'),
            createErrorContext('API', 'request_cancelled', {
              requestId,
              url,
              method
            })
          );
          throw abortError;
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const networkError = createAppError(
            error,
            createErrorContext('API', 'network_error', {
              requestId,
              url,
              method,
              networkDetails: {
                url,
                method,
                timeout: options.signal?.aborted
              } as NetworkErrorDetails
            })
          );
          throw networkError;
        }

        // Re-throw AppError instances
        if (error.id && error.category) {
          throw error;
        }

        // Handle other errors
        const apiError = createAppError(
          error,
          createErrorContext('API', 'request_error', {
            requestId,
            url,
            method
          })
        );
        throw apiError;
      }
    };

    try {
      let result: T = await makeRequest();
      trackRequestEnd(requestId);
      return result;
    } catch (error: any) {
      const tracker = activeRequests.current.get(requestId);
      const retryCount = tracker?.retryCount || 0;

      // Check if we should retry
      if (shouldRetryRequest(error, retryCount, config)) {
        try {
          const retryResult: T = await executeRetry(
            requestId,
            makeRequest,
            retryCount,
            config,
            (attempt: number) => {
              console.log(`Retrying request ${requestId} (attempt ${attempt})`);
            }
          );
          trackRequestEnd(requestId);
          return retryResult;
        } catch (retryError) {
          trackRequestEnd(requestId);
          throw retryError;
        }
      }

      trackRequestEnd(requestId);
      throw error;
    }
  }, [
    generateRequestId,
    trackRequestStart,
    trackRequestEnd,
    shouldRetryRequest,
    executeRetry
  ]);

  // GET request
  const get = useCallback(<T = any>(
    url: string,
    options: RequestInit = {},
    retryConfig?: Partial<RetryConfig>
  ) => {
    return apiRequest<T>(url, { ...options, method: 'GET' }, retryConfig);
  }, [apiRequest]);

  // POST request
  const post = useCallback(<T = any>(
    url: string,
    data?: any,
    options: RequestInit = {},
    retryConfig?: Partial<RetryConfig>
  ) => {
    return apiRequest<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    }, retryConfig);
  }, [apiRequest]);

  // PUT request
  const put = useCallback(<T = any>(
    url: string,
    data?: any,
    options: RequestInit = {},
    retryConfig?: Partial<RetryConfig>
  ) => {
    return apiRequest<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    }, retryConfig);
  }, [apiRequest]);

  // DELETE request
  const del = useCallback(<T = any>(
    url: string,
    options: RequestInit = {},
    retryConfig?: Partial<RetryConfig>
  ) => {
    return apiRequest<T>(url, { ...options, method: 'DELETE' }, retryConfig);
  }, [apiRequest]);

  // Cancel all active requests
  const cancelAllRequests = useCallback(() => {
    activeRequests.current.forEach((tracker, requestId) => {
      cancelRequest(requestId);
    });
    activeRequests.current.clear();

    retryTimeouts.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    retryTimeouts.current.clear();
  }, [cancelRequest]);

  // Get active requests count
  const getActiveRequestsCount = useCallback(() => {
    return activeRequests.current.size;
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    cancelAllRequests();
  }, [cancelAllRequests]);

  return {
    // Request methods
    get,
    post,
    put,
    delete: del,
    request: apiRequest,

    // Management methods
    cancelRequest,
    cancelAllRequests,
    getActiveRequestsCount,
    cleanup,

    // Request tracking
    activeRequests: activeRequests.current
  };
};

// Specialized hook for Gemini API
export const useGeminiApi = () => {
  const { post, cancelAllRequests } = useApiErrorHandler();

  const callGeminiApi = useCallback(async (
    history: any[],
    fileSystem: { [path: string]: string }
  ) => {
    try {
      const response = await post('/api/generate-gemini', {
        history,
        fileSystem
      });

      return response;
    } catch (error: any) {
      // Log the error (already handled by the hook)
      throw error;
    }
  }, [post]);

  return {
    callGeminiApi,
    cancelAllRequests
  };
};

// Network status monitoring hook
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.navigator.onLine;
    }
    return true;
  });

  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality('good');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
    };

    // Monitor connection quality
    const checkConnectionQuality = async () => {
      if (!isOnline) return;

      try {
        const startTime = Date.now();
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-cache'
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (responseTime > 3000) {
          setConnectionQuality('poor');
        } else {
          setConnectionQuality('good');
        }
      } catch {
        setConnectionQuality('poor');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection quality periodically
    const qualityCheckInterval = setInterval(checkConnectionQuality, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(qualityCheckInterval);
    };
  }, [isOnline]);

  return {
    isOnline,
    connectionQuality,
    isConnectionPoor: connectionQuality === 'poor',
    isOffline: !isOnline
  };
};

// Network status hook is defined above