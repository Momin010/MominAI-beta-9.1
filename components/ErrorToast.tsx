// components/ErrorToast.tsx - Error Toast Notification System
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AppError,
  ErrorSeverity,
  ErrorCategory
} from '../types';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpinnerIcon
} from './icons/Icons';

interface ErrorToastProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
  autoHideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  onRetry,
  autoHideDelay = 5000,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  // Auto-hide timer
  useEffect(() => {
    if (error.severity === ErrorSeverity.CRITICAL || !autoHideDelay) return;

    const startTime = Date.now();
    const duration = autoHideDelay;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setProgress((remaining / duration) * 100);

      if (remaining <= 0) {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Allow animation to complete
      }
    }, 50);

    return () => clearInterval(timer);
  }, [error.severity, autoHideDelay, onDismiss]);

  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-500',
          title: 'text-red-800 dark:text-red-200',
          message: 'text-red-700 dark:text-red-300',
          progress: 'bg-red-500'
        };
      case ErrorSeverity.HIGH:
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          border: 'border-orange-200 dark:border-orange-800',
          icon: 'text-orange-500',
          title: 'text-orange-800 dark:text-orange-200',
          message: 'text-orange-700 dark:text-orange-300',
          progress: 'bg-orange-500'
        };
      case ErrorSeverity.MEDIUM:
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-500',
          title: 'text-yellow-800 dark:text-yellow-200',
          message: 'text-yellow-700 dark:text-yellow-300',
          progress: 'bg-yellow-500'
        };
      case ErrorSeverity.LOW:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-500',
          title: 'text-blue-800 dark:text-blue-200',
          message: 'text-blue-700 dark:text-blue-300',
          progress: 'bg-blue-500'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          border: 'border-gray-200 dark:border-gray-800',
          icon: 'text-gray-500',
          title: 'text-gray-800 dark:text-gray-200',
          message: 'text-gray-700 dark:text-gray-300',
          progress: 'bg-gray-500'
        };
    }
  };

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case ErrorCategory.NETWORK:
        return <XCircleIcon className="w-5 h-5" />;
      case ErrorCategory.API:
        return <AlertTriangleIcon className="w-5 h-5" />;
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.AUTHORIZATION:
        return <XCircleIcon className="w-5 h-5" />;
      case ErrorCategory.VALIDATION:
        return <AlertTriangleIcon className="w-5 h-5" />;
      case ErrorCategory.TIMEOUT:
        return <SpinnerIcon className="w-5 h-5" />;
      default:
        return <AlertTriangleIcon className="w-5 h-5" />;
    }
  };

  const styles = getSeverityStyles(error.severity);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed z-50 max-w-sm w-full transition-all duration-300 ease-in-out
        ${position === 'top-right' ? 'top-4 right-4' : ''}
        ${position === 'top-left' ? 'top-4 left-4' : ''}
        ${position === 'bottom-right' ? 'bottom-4 right-4' : ''}
        ${position === 'bottom-left' ? 'bottom-4 left-4' : ''}
        ${position === 'top-center' ? 'top-4 left-1/2 transform -translate-x-1/2' : ''}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className={`${styles.bg} ${styles.border} border rounded-lg shadow-lg overflow-hidden`}>
        {/* Progress bar for auto-hide */}
        {error.severity !== ErrorSeverity.CRITICAL && autoHideDelay && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full ${styles.progress} transition-all duration-50 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className={`${styles.icon}`}>
                {getCategoryIcon(error.category)}
              </div>
              <div>
                <h4 className={`text-sm font-semibold ${styles.title}`}>
                  {getErrorTitle(error.category)}
                </h4>
                <p className={`text-sm ${styles.message} mt-1`}>
                  {error.userMessage}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <XCircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
            </button>
          </div>

          {/* Suggested Actions */}
          {error.suggestedActions && error.suggestedActions.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {error.suggestedActions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (action.toLowerCase().includes('refresh') || action.toLowerCase().includes('reload')) {
                        window.location.reload();
                      } else if (action.toLowerCase().includes('retry') && onRetry) {
                        onRetry();
                      }
                    }}
                    className="text-xs px-2 py-1 bg-white/50 dark:bg-black/30 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 hover:bg-white/70 dark:hover:bg-black/50 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error ID and Report Link */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-mono">
              ID: {error.id.slice(-8)}
            </span>
            <button
              onClick={() => {
                // In a real app, this would open a report dialog
                const reportUrl = `mailto:support@mominai.com?subject=Error Report: ${error.id}&body=Error Details:%0A${encodeURIComponent(JSON.stringify({
                  id: error.id,
                  message: error.message,
                  category: error.category,
                  severity: error.severity,
                  timestamp: error.timestamp.toISOString(),
                  userMessage: error.userMessage
                }, null, 2))}`;
                window.open(reportUrl);
              }}
              className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <span>Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function
const getErrorTitle = (category: ErrorCategory): string => {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Connection Issue';
    case ErrorCategory.API:
      return 'Service Error';
    case ErrorCategory.AUTHENTICATION:
      return 'Sign In Required';
    case ErrorCategory.AUTHORIZATION:
      return 'Access Denied';
    case ErrorCategory.VALIDATION:
      return 'Check Your Input';
    case ErrorCategory.CONFIGURATION:
      return 'Setup Issue';
    case ErrorCategory.RUNTIME:
      return 'Something Went Wrong';
    case ErrorCategory.RESOURCE:
      return 'Service Busy';
    case ErrorCategory.TIMEOUT:
      return 'Taking Too Long';
    default:
      return 'Notice';
  }
};

// Error Toast Container Component
interface ErrorToastContainerProps {
  toasts: Array<{
    id: string;
    error: AppError;
    onRetry?: () => void;
  }>;
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

export const ErrorToastContainer: React.FC<ErrorToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top-right'
}) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className={`
        absolute space-y-2 pointer-events-auto
        ${position === 'top-right' ? 'top-4 right-4' : ''}
        ${position === 'top-left' ? 'top-4 left-4' : ''}
        ${position === 'bottom-right' ? 'bottom-4 right-4' : ''}
        ${position === 'bottom-left' ? 'bottom-4 left-4' : ''}
        ${position === 'top-center' ? 'top-4 left-1/2 transform -translate-x-1/2' : ''}
      `}>
        {toasts.map((toast) => (
          <ErrorToast
            key={toast.id}
            error={toast.error}
            onDismiss={() => onDismiss(toast.id)}
            onRetry={toast.onRetry}
            position="top-right" // Individual toasts don't need positioning
            autoHideDelay={toast.error.severity === ErrorSeverity.CRITICAL ? 0 : 5000}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};

// Error Toast Manager Hook
export const useErrorToast = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    error: AppError;
    onRetry?: () => void;
  }>>([]);

  const showError = useCallback((error: AppError, onRetry?: () => void) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, error, onRetry }]);

    // Auto-remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, error.severity === ErrorSeverity.CRITICAL ? 10000 : 6000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showError,
    dismissToast,
    clearAllToasts
  };
};

// Success/Error Toast Hook (for non-error notifications)
export const useToast = () => {
  const { showError } = useErrorToast();

  const showSuccess = useCallback((message: string, title = 'Success') => {
    const successError: AppError = {
      id: `success_${Date.now()}`,
      message: title,
      userMessage: message,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.LOW,
      context: {
        component: 'toast',
        action: 'success_notification',
        timestamp: new Date()
      },
      retryable: false,
      timestamp: new Date()
    };
    showError(successError);
  }, [showError]);

  const showInfo = useCallback((message: string, title = 'Info') => {
    const infoError: AppError = {
      id: `info_${Date.now()}`,
      message: title,
      userMessage: message,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.LOW,
      context: {
        component: 'toast',
        action: 'info_notification',
        timestamp: new Date()
      },
      retryable: false,
      timestamp: new Date()
    };
    showError(infoError);
  }, [showError]);

  return {
    showSuccess,
    showInfo,
    showError
  };
};

// useState is already imported above

export default ErrorToast;