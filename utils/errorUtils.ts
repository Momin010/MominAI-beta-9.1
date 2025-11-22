// utils/errorUtils.ts - Comprehensive Error Handling System
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  NetworkErrorDetails,
  APIErrorDetails,
  ValidationErrorDetails,
  AuthErrorDetails,
  ConfigurationErrorDetails,
  ResourceErrorDetails,
  RecoveryStrategy,
  ErrorRecovery
} from '../types';

// Error ID generator
export const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create error context
export const createErrorContext = (
  component?: string,
  action?: string,
  metadata?: Record<string, any>
): ErrorContext => {
  return {
    component,
    action,
    timestamp: new Date(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    metadata
  };
};

// Network error detection and classification
export const classifyNetworkError = (error: any): { category: ErrorCategory; details: NetworkErrorDetails } => {
  const details: NetworkErrorDetails = {};

  if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
    return { category: ErrorCategory.TIMEOUT, details: { ...details, timeout: true } };
  }

  if (error.response) {
    details.status = error.response.status;
    details.statusText = error.response.statusText;
    details.url = error.config?.url;
    details.method = error.config?.method?.toUpperCase();
    details.responseTime = error.response.config?.metadata?.endTime - error.response.config?.metadata?.startTime;
  } else if (error.request) {
    // Network error (no response received)
    details.url = error.config?.url;
    details.method = error.config?.method?.toUpperCase();
    return { category: ErrorCategory.NETWORK, details };
  }

  // Determine category based on status code
  if (details.status) {
    if (details.status >= 400 && details.status < 500) {
      return { category: ErrorCategory.API, details };
    } else if (details.status >= 500) {
      return { category: ErrorCategory.RESOURCE, details };
    }
  }

  return { category: ErrorCategory.UNKNOWN, details };
};

// API error classification
export const classifyAPIError = (error: any): { category: ErrorCategory; details: APIErrorDetails } => {
  const details: APIErrorDetails = {
    endpoint: error.config?.url || '',
    method: error.config?.method?.toUpperCase() || 'GET',
    statusCode: error.response?.status || 0,
    responseBody: error.response?.data,
    requestBody: error.config?.data,
    headers: error.config?.headers
  };

  if (details.statusCode === 401) {
    return { category: ErrorCategory.AUTHENTICATION, details };
  } else if (details.statusCode === 403) {
    return { category: ErrorCategory.AUTHORIZATION, details };
  } else if (details.statusCode === 422 || details.statusCode === 400) {
    return { category: ErrorCategory.VALIDATION, details };
  } else if (details.statusCode >= 500) {
    return { category: ErrorCategory.RESOURCE, details };
  }

  return { category: ErrorCategory.API, details };
};

// Determine error severity
export const determineSeverity = (category: ErrorCategory, statusCode?: number): ErrorSeverity => {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.AUTHORIZATION:
      return ErrorSeverity.HIGH;
    case ErrorCategory.CONFIGURATION:
      return ErrorSeverity.CRITICAL;
    case ErrorCategory.RESOURCE:
      return statusCode && statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    case ErrorCategory.NETWORK:
    case ErrorCategory.TIMEOUT:
      return ErrorSeverity.MEDIUM;
    case ErrorCategory.VALIDATION:
      return ErrorSeverity.LOW;
    default:
      return ErrorSeverity.MEDIUM;
  }
};

// Determine if error is retryable
export const isRetryable = (category: ErrorCategory, statusCode?: number): boolean => {
  switch (category) {
    case ErrorCategory.NETWORK:
    case ErrorCategory.TIMEOUT:
      return true;
    case ErrorCategory.RESOURCE:
      return statusCode ? statusCode >= 500 && statusCode !== 501 : false;
    case ErrorCategory.API:
      return statusCode ? statusCode >= 500 || statusCode === 429 : false;
    default:
      return false;
  }
};

// Generate user-friendly error messages
export const generateUserMessage = (category: ErrorCategory, severity: ErrorSeverity, details?: any): string => {
  const messages = {
    [ErrorCategory.NETWORK]: {
      [ErrorSeverity.LOW]: "Connection issue detected. Please check your internet connection.",
      [ErrorSeverity.MEDIUM]: "Network connection is unstable. Some features may not work properly.",
      [ErrorSeverity.HIGH]: "Unable to connect to our servers. Please check your internet connection and try again.",
      [ErrorSeverity.CRITICAL]: "Critical network failure. Please contact support if this persists."
    },
    [ErrorCategory.API]: {
      [ErrorSeverity.LOW]: "There was a minor issue with the request. Please try again.",
      [ErrorSeverity.MEDIUM]: "Service temporarily unavailable. Please try again in a moment.",
      [ErrorSeverity.HIGH]: "API service error. Our team has been notified.",
      [ErrorSeverity.CRITICAL]: "Critical API failure. Please contact support."
    },
    [ErrorCategory.AUTHENTICATION]: {
      [ErrorSeverity.LOW]: "Please sign in to continue.",
      [ErrorSeverity.MEDIUM]: "Your session has expired. Please sign in again.",
      [ErrorSeverity.HIGH]: "Authentication failed. Please check your credentials.",
      [ErrorSeverity.CRITICAL]: "Security issue detected. Please contact support immediately."
    },
    [ErrorCategory.AUTHORIZATION]: {
      [ErrorSeverity.LOW]: "You don't have permission for this action.",
      [ErrorSeverity.MEDIUM]: "Access denied. Please check your permissions.",
      [ErrorSeverity.HIGH]: "Insufficient privileges. Contact your administrator.",
      [ErrorSeverity.CRITICAL]: "Security violation detected. Please contact support."
    },
    [ErrorCategory.VALIDATION]: {
      [ErrorSeverity.LOW]: "Please check your input and try again.",
      [ErrorSeverity.MEDIUM]: "Some information is missing or incorrect.",
      [ErrorSeverity.HIGH]: "Validation failed. Please review your data.",
      [ErrorSeverity.CRITICAL]: "Data validation error. Please contact support."
    },
    [ErrorCategory.CONFIGURATION]: {
      [ErrorSeverity.LOW]: "Configuration issue detected.",
      [ErrorSeverity.MEDIUM]: "Service configuration error.",
      [ErrorSeverity.HIGH]: "Critical configuration problem.",
      [ErrorSeverity.CRITICAL]: "System configuration failure. Please contact support."
    },
    [ErrorCategory.RUNTIME]: {
      [ErrorSeverity.LOW]: "Something went wrong. Please try again.",
      [ErrorSeverity.MEDIUM]: "Application error occurred.",
      [ErrorSeverity.HIGH]: "Critical application error.",
      [ErrorSeverity.CRITICAL]: "System failure. Please contact support."
    },
    [ErrorCategory.RESOURCE]: {
      [ErrorSeverity.LOW]: "Resource temporarily unavailable.",
      [ErrorSeverity.MEDIUM]: "Service is experiencing high load.",
      [ErrorSeverity.HIGH]: "Service overload. Please try again later.",
      [ErrorSeverity.CRITICAL]: "Critical resource failure. Please contact support."
    },
    [ErrorCategory.TIMEOUT]: {
      [ErrorSeverity.LOW]: "Request timed out. Please try again.",
      [ErrorSeverity.MEDIUM]: "Operation took too long. Please try again.",
      [ErrorSeverity.HIGH]: "Request timeout. Service may be overloaded.",
      [ErrorSeverity.CRITICAL]: "Critical timeout. Please contact support."
    },
    [ErrorCategory.UNKNOWN]: {
      [ErrorSeverity.LOW]: "An unexpected issue occurred.",
      [ErrorSeverity.MEDIUM]: "Something unexpected happened.",
      [ErrorSeverity.HIGH]: "Unexpected error occurred.",
      [ErrorSeverity.CRITICAL]: "Critical system error. Please contact support."
    }
  };

  return messages[category]?.[severity] || "An error occurred. Please try again.";
};

// Generate suggested actions
export const generateSuggestedActions = (error: AppError): string[] => {
  const actions: string[] = [];

  if (error.retryable) {
    actions.push("Try again");
  }

  switch (error.category) {
    case ErrorCategory.NETWORK:
      actions.push("Check your internet connection", "Try refreshing the page");
      break;
    case ErrorCategory.AUTHENTICATION:
      actions.push("Sign in again", "Check your credentials");
      break;
    case ErrorCategory.AUTHORIZATION:
      actions.push("Contact your administrator", "Check your permissions");
      break;
    case ErrorCategory.VALIDATION:
      actions.push("Review your input", "Check required fields");
      break;
    case ErrorCategory.CONFIGURATION:
      actions.push("Contact support", "Try again later");
      break;
    case ErrorCategory.TIMEOUT:
      actions.push("Wait a moment and try again", "Check your connection");
      break;
    default:
      actions.push("Refresh the page", "Contact support if the problem persists");
  }

  return [...new Set(actions)]; // Remove duplicates
};

// Create AppError from various error types
export const createAppError = (
  error: any,
  context: ErrorContext,
  customMessage?: string
): AppError => {
  let category = ErrorCategory.UNKNOWN;
  let severity = ErrorSeverity.MEDIUM;
  let details: any = {};
  let retryable = false;

  // Classify the error
  if (error.response || error.request) {
    // Axios-like error
    const classification = error.response ? classifyAPIError(error) : classifyNetworkError(error);
    category = classification.category;
    details = classification.details;
  } else if (error.name === 'ValidationError') {
    category = ErrorCategory.VALIDATION;
    details = error.details as ValidationErrorDetails;
  } else if (error.name === 'AuthError') {
    category = ErrorCategory.AUTHENTICATION;
    details = error.details as AuthErrorDetails;
  } else if (error.name === 'ConfigError') {
    category = ErrorCategory.CONFIGURATION;
    details = error.details as ConfigurationErrorDetails;
  } else if (error.name === 'ResourceError') {
    category = ErrorCategory.RESOURCE;
    details = error.details as ResourceErrorDetails;
  } else if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
    category = ErrorCategory.TIMEOUT;
  } else if (error instanceof Error) {
    category = ErrorCategory.RUNTIME;
  }

  severity = determineSeverity(category, details.statusCode || details.status);
  retryable = isRetryable(category, details.statusCode || details.status);

  const userMessage = customMessage || generateUserMessage(category, severity, details);
  const suggestedActions = generateSuggestedActions({ category, severity, retryable } as AppError);

  return {
    id: generateErrorId(),
    message: error.message || 'An error occurred',
    code: error.code,
    category,
    severity,
    context,
    originalError: error,
    stack: error.stack,
    retryable,
    userMessage,
    suggestedActions,
    technicalDetails: JSON.stringify(details, null, 2),
    timestamp: new Date()
  };
};

// Error recovery strategies
export const getRecoveryStrategy = (error: AppError): ErrorRecovery => {
  switch (error.category) {
    case ErrorCategory.NETWORK:
    case ErrorCategory.TIMEOUT:
      return {
        strategy: RecoveryStrategy.RETRY,
        delay: 1000,
        maxRetries: 3
      };
    case ErrorCategory.AUTHENTICATION:
      return {
        strategy: RecoveryStrategy.REDIRECT,
        redirectUrl: '/auth'
      };
    case ErrorCategory.API:
      if (error.retryable) {
        return {
          strategy: RecoveryStrategy.RETRY,
          delay: 2000,
          maxRetries: 2
        };
      }
      return {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackData: null
      };
    case ErrorCategory.CONFIGURATION:
      return {
        strategy: RecoveryStrategy.REFRESH,
        delay: 5000
      };
    default:
      return {
        strategy: RecoveryStrategy.IGNORE
      };
  }
};

// Error logging
export const logError = (error: AppError): void => {
  const logData = {
    id: error.id,
    message: error.message,
    category: error.category,
    severity: error.severity,
    component: error.context.component,
    action: error.context.action,
    timestamp: error.timestamp.toISOString(),
    userMessage: error.userMessage,
    technicalDetails: error.technicalDetails
  };

  // Log to console with appropriate level
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('🚨 CRITICAL ERROR:', logData);
      break;
    case ErrorSeverity.HIGH:
      console.error('❌ HIGH ERROR:', logData);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('⚠️ MEDIUM ERROR:', logData);
      break;
    case ErrorSeverity.LOW:
      console.info('ℹ️ LOW ERROR:', logData);
      break;
  }

  // In production, send to error reporting service
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Send to error reporting service (e.g., Sentry, LogRocket, etc.)
    try {
      // Placeholder for error reporting service
      // reportError(error);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }
};

// Global error handler
export const setupGlobalErrorHandling = (): void => {
  if (typeof window === 'undefined') return;

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = createAppError(
      event.reason,
      createErrorContext('global', 'unhandled_promise_rejection')
    );
    logError(error);
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = createAppError(
      event.error,
      createErrorContext('global', 'uncaught_error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    );
    logError(error);
  });

  // Handle network errors
  window.addEventListener('offline', () => {
    const error = createAppError(
      new Error('Network connection lost'),
      createErrorContext('global', 'network_offline')
    );
    logError(error);
  });

  window.addEventListener('online', () => {
    console.info('🔄 Network connection restored');
  });
};

// Utility to check if error should trigger error boundary
export const shouldTriggerErrorBoundary = (error: AppError): boolean => {
  return error.severity === ErrorSeverity.CRITICAL ||
         error.category === ErrorCategory.CONFIGURATION ||
         error.category === ErrorCategory.RUNTIME;
};

// Utility to get error display duration
export const getErrorDisplayDuration = (severity: ErrorSeverity): number => {
  switch (severity) {
    case ErrorSeverity.LOW:
      return 3000; // 3 seconds
    case ErrorSeverity.MEDIUM:
      return 5000; // 5 seconds
    case ErrorSeverity.HIGH:
      return 8000; // 8 seconds
    case ErrorSeverity.CRITICAL:
      return 0; // Don't auto-dismiss
    default:
      return 5000;
  }
};

// Utility to format error for display
export const formatErrorForDisplay = (error: AppError) => {
  return {
    title: getErrorTitle(error),
    message: error.userMessage,
    severity: error.severity,
    category: error.category,
    actions: error.suggestedActions,
    technical: process.env.NODE_ENV === 'development' ? error.technicalDetails : undefined
  };
};

// Get error title
const getErrorTitle = (error: AppError): string => {
  switch (error.category) {
    case ErrorCategory.NETWORK:
      return 'Connection Problem';
    case ErrorCategory.API:
      return 'Service Error';
    case ErrorCategory.AUTHENTICATION:
      return 'Authentication Required';
    case ErrorCategory.AUTHORIZATION:
      return 'Access Denied';
    case ErrorCategory.VALIDATION:
      return 'Invalid Input';
    case ErrorCategory.CONFIGURATION:
      return 'Configuration Error';
    case ErrorCategory.RUNTIME:
      return 'Application Error';
    case ErrorCategory.RESOURCE:
      return 'Service Unavailable';
    case ErrorCategory.TIMEOUT:
      return 'Request Timeout';
    default:
      return 'Something Went Wrong';
  }
};

// All functions are already exported above