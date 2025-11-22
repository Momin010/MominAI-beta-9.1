// components/ErrorBoundary.tsx - Comprehensive Error Boundary Component
import React, { Component, ReactNode } from 'react';
import {
  AppError,
  ErrorBoundaryState,
  ErrorSeverity,
  ErrorCategory,
  ErrorOverlayProps,
  ErrorPageProps
} from '../types';
import { createAppError, createErrorContext, logError, shouldTriggerErrorBoundary } from '../utils/errorUtils';
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon, BugIcon, XCircleIcon } from './icons/Icons';

// Error Overlay Component
const ErrorOverlay: React.FC<ErrorOverlayProps> = ({
  error,
  onRetry,
  onDismiss,
  onReport
}) => {
  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return {
          bg: 'bg-red-900/95',
          border: 'border-red-500',
          icon: 'text-red-400',
          title: 'text-red-200',
          message: 'text-red-100'
        };
      case ErrorSeverity.HIGH:
        return {
          bg: 'bg-orange-900/95',
          border: 'border-orange-500',
          icon: 'text-orange-400',
          title: 'text-orange-200',
          message: 'text-orange-100'
        };
      case ErrorSeverity.MEDIUM:
        return {
          bg: 'bg-yellow-900/95',
          border: 'border-yellow-500',
          icon: 'text-yellow-400',
          title: 'text-yellow-200',
          message: 'text-yellow-100'
        };
      case ErrorSeverity.LOW:
        return {
          bg: 'bg-blue-900/95',
          border: 'border-blue-500',
          icon: 'text-blue-400',
          title: 'text-blue-200',
          message: 'text-blue-100'
        };
      default:
        return {
          bg: 'bg-gray-900/95',
          border: 'border-gray-500',
          icon: 'text-gray-400',
          title: 'text-gray-200',
          message: 'text-gray-100'
        };
    }
  };

  const styles = getSeverityStyles(error.severity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`max-w-md w-full ${styles.bg} border ${styles.border} rounded-xl shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <AlertTriangleIcon className={`w-6 h-6 ${styles.icon}`} />
            <h3 className={`text-lg font-semibold ${styles.title}`}>
              {getErrorTitle(error.category)}
            </h3>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <XCircleIcon className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className={`text-sm ${styles.message} mb-4`}>
            {error.userMessage}
          </p>

          {/* Technical Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && error.technicalDetails && (
            <details className="mb-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                Technical Details
              </summary>
              <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-300 overflow-x-auto max-h-32">
                {error.technicalDetails}
              </pre>
            </details>
          )}

          {/* Suggested Actions */}
          {error.suggestedActions && error.suggestedActions.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">What you can do:</h4>
              <ul className="space-y-1">
                {error.suggestedActions.map((action, index) => (
                  <li key={index} className="text-sm text-gray-400 flex items-center">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-2 flex-shrink-0"></span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-white/10 bg-black/20">
          {onReport && (
            <button
              onClick={onReport}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <BugIcon className="w-4 h-4" />
              <span>Report Issue</span>
            </button>
          )}
          {onRetry && error.retryable && (
            <button
              onClick={onRetry}
              className="flex items-center space-x-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <RefreshCwIcon className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Error Page Component
const ErrorPage: React.FC<ErrorPageProps> = ({
  error,
  onRetry,
  onGoHome
}) => {
  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return {
          bg: 'from-red-900 to-red-800',
          icon: 'text-red-400',
          title: 'text-red-200',
          message: 'text-red-100'
        };
      case ErrorSeverity.HIGH:
        return {
          bg: 'from-orange-900 to-orange-800',
          icon: 'text-orange-400',
          title: 'text-orange-200',
          message: 'text-orange-100'
        };
      default:
        return {
          bg: 'from-gray-900 to-gray-800',
          icon: 'text-gray-400',
          title: 'text-gray-200',
          message: 'text-gray-100'
        };
    }
  };

  const styles = getSeverityStyles(error.severity);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${styles.bg} flex items-center justify-center p-4`}>
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <AlertTriangleIcon className={`w-24 h-24 mx-auto ${styles.icon}`} />
        </div>

        {/* Title */}
        <h1 className={`text-4xl font-bold ${styles.title} mb-4`}>
          {getErrorTitle(error.category)}
        </h1>

        {/* Message */}
        <p className={`text-xl ${styles.message} mb-8 max-w-lg mx-auto`}>
          {error.userMessage}
        </p>

        {/* Technical Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && error.technicalDetails && (
          <details className="mb-8 text-left max-w-lg mx-auto">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 mb-4">
              Technical Details (Development)
            </summary>
            <pre className="p-4 bg-black/30 rounded-lg text-sm text-gray-300 overflow-x-auto max-h-64">
              {error.technicalDetails}
            </pre>
          </details>
        )}

        {/* Suggested Actions */}
        {error.suggestedActions && error.suggestedActions.length > 0 && (
          <div className="mb-8 max-w-lg mx-auto">
            <h3 className="text-lg font-medium text-gray-300 mb-4">What you can do:</h3>
            <div className="grid gap-3">
              {error.suggestedActions.map((action, index) => (
                <div key={index} className="flex items-center justify-center p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-gray-300">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center space-x-4">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
              <span>Go Home</span>
            </button>
          )}
          {onRetry && error.retryable && (
            <button
              onClick={onRetry}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <RefreshCwIcon className="w-5 h-5" />
              <span>Try Again</span>
            </button>
          )}
        </div>

        {/* Error ID */}
        <div className="mt-8 text-xs text-gray-500">
          Error ID: {error.id}
        </div>
      </div>
    </div>
  );
};

// Helper function to get error title
const getErrorTitle = (category: ErrorCategory): string => {
  switch (category) {
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

// Main Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: AppError) => void;
  showOverlay?: boolean;
  showPage?: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Create AppError from the caught error
    const appError = createAppError(
      error,
      createErrorContext('ErrorBoundary', 'component_error')
    );

    return {
      hasError: true,
      error: appError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error
    if (this.state.error) {
      logError(this.state.error);
    }

    // Call onError callback if provided
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error);
    }

    // Store error info for debugging
    this.setState(prevState => ({
      ...prevState,
      errorInfo: {
        componentStack: errorInfo.componentStack
      }
    }));
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: undefined
    });
  };

  handleDismiss = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: undefined
    });
  };

  handleReport = () => {
    if (this.state.error) {
      // In a real app, this would send the error report to a service
      const reportData = {
        error: this.state.error,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      console.log('Error Report:', reportData);

      // Show feedback to user
      alert('Thank you for reporting this issue. Our team has been notified.');
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show full page error for critical errors
      if (this.props.showPage && shouldTriggerErrorBoundary(this.state.error)) {
        return (
          <ErrorPage
            error={this.state.error}
            onRetry={this.state.error.retryable ? this.handleRetry : undefined}
            onGoHome={() => window.location.href = '/'}
          />
        );
      }

      // Show overlay for non-critical errors
      if (this.props.showOverlay) {
        return (
          <ErrorOverlay
            error={this.state.error}
            onRetry={this.state.error.retryable ? this.handleRetry : undefined}
            onDismiss={this.handleDismiss}
            onReport={this.handleReport}
          />
        );
      }

      // Default inline error display
      return (
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangleIcon className="w-5 h-5 text-red-400" />
            <h3 className="text-red-200 font-medium">Something went wrong</h3>
          </div>
          <p className="text-red-100 text-sm mb-3">
            {this.state.error.userMessage}
          </p>
          <div className="flex space-x-2">
            {this.state.error.retryable && (
              <button
                onClick={this.handleRetry}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={this.handleReport}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
            >
              Report Issue
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Hook for manual error handling
export const useErrorHandler = () => {
  const handleError = (error: any, context?: Partial<Parameters<typeof createErrorContext>[0]>) => {
    const appError = createAppError(
      error,
      createErrorContext(
        context?.component || 'unknown',
        context?.action || 'manual_error',
        context?.metadata
      )
    );

    logError(appError);

    // In a real app, you might want to show a toast or overlay here
    console.error('Handled error:', appError);

    return appError;
  };

  return { handleError };
};

export default ErrorBoundary;
export { ErrorOverlay, ErrorPage };