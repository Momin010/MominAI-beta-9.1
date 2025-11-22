import { supabase } from '../lib/supabaseClient';

interface ErrorReport {
  id: string;
  projectId: string;
  userId: string;
  errorType: 'api_error' | 'build_error' | 'runtime_error' | 'network_error' | 'auth_error';
  message: string;
  stack?: string;
  context: any;
  timestamp: number;
  resolved: boolean;
}

class ErrorHandlingService {
  private errorQueue: ErrorReport[] = [];
  private retryAttempts = new Map<string, number>();

  async reportError(
    projectId: string,
    errorType: ErrorReport['errorType'],
    message: string,
    context: any = {},
    stack?: string
  ): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    const errorReport: Omit<ErrorReport, 'id'> = {
      projectId,
      userId,
      errorType,
      message,
      stack,
      context,
      timestamp: Date.now(),
      resolved: false
    };

    // Add to queue for batch processing
    this.errorQueue.push({ ...errorReport, id: Date.now().toString() });

    // Process queue if it gets too large
    if (this.errorQueue.length >= 5) {
      await this.flushErrorQueue();
    }

    // Handle specific error types
    await this.handleSpecificError(errorType, errorReport);
  }

  private async handleSpecificError(errorType: ErrorReport['errorType'], error: Omit<ErrorReport, 'id'>): Promise<void> {
    switch (errorType) {
      case 'api_error':
        await this.handleApiError(error);
        break;
      case 'build_error':
        await this.handleBuildError(error);
        break;
      case 'auth_error':
        await this.handleAuthError(error);
        break;
      case 'network_error':
        await this.handleNetworkError(error);
        break;
    }
  }

  private async handleApiError(error: Omit<ErrorReport, 'id'>): Promise<void> {
    const key = `api_error_${error.context.provider || 'unknown'}`;
    const attempts = this.retryAttempts.get(key) || 0;

    if (attempts < 3) {
      this.retryAttempts.set(key, attempts + 1);
      console.warn(`API error detected, attempt ${attempts + 1}/3:`, error.message);

      // Could implement exponential backoff here
      setTimeout(() => {
        // Retry logic would go here
      }, Math.pow(2, attempts) * 1000);
    } else {
      console.error('API error threshold exceeded, manual intervention required');
      this.retryAttempts.delete(key);
    }
  }

  private async handleBuildError(error: Omit<ErrorReport, 'id'>): Promise<void> {
    // Analyze build errors and provide suggestions
    const suggestions = this.analyzeBuildError(error.message);

    if (suggestions.length > 0) {
      console.log('Build error suggestions:', suggestions);
      // Could send these suggestions to the UI
    }
  }

  private async handleAuthError(error: Omit<ErrorReport, 'id'>): Promise<void> {
    // Handle authentication errors
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      console.warn('Authentication token issue detected');
      // Could trigger token refresh
    }
  }

  private async handleNetworkError(error: Omit<ErrorReport, 'id'>): Promise<void> {
    // Handle network connectivity issues
    console.warn('Network error detected, checking connectivity...');

    // Could implement offline mode or retry logic
    if (navigator.onLine === false) {
      console.error('User appears to be offline');
    }
  }

  private analyzeBuildError(errorMessage: string): string[] {
    const suggestions: string[] = [];

    if (errorMessage.includes('Cannot find module')) {
      suggestions.push('Missing dependency - try running npm install');
    }

    if (errorMessage.includes('TypeScript error')) {
      suggestions.push('TypeScript compilation error - check type definitions');
    }

    if (errorMessage.includes('SyntaxError')) {
      suggestions.push('Syntax error - check code syntax');
    }

    return suggestions;
  }

  async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const { error } = await supabase
        .from('error_reports')
        .insert(errors.map(err => ({
          project_id: err.projectId,
          user_id: err.userId,
          error_type: err.errorType,
          message: err.message,
          stack: err.stack,
          context: JSON.stringify(err.context),
          timestamp: err.timestamp,
          resolved: err.resolved
        })));

      if (error) {
        console.error('Failed to save error reports:', error);
        // Re-queue errors for retry
        this.errorQueue.unshift(...errors);
      }
    } catch (e) {
      console.error('Error flushing error queue:', e);
      this.errorQueue.unshift(...errors);
    }
  }

  async getErrorReports(projectId: string, limit = 50): Promise<ErrorReport[]> {
    const { data, error } = await supabase
      .from('error_reports')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch error reports:', error);
      return [];
    }

    return data.map(item => ({
      id: item.id,
      projectId: item.project_id,
      userId: item.user_id,
      errorType: item.error_type,
      message: item.message,
      stack: item.stack,
      context: JSON.parse(item.context),
      timestamp: item.timestamp,
      resolved: item.resolved
    }));
  }

  async markErrorResolved(errorId: string): Promise<void> {
    const { error } = await supabase
      .from('error_reports')
      .update({ resolved: true })
      .eq('id', errorId);

    if (error) {
      console.error('Failed to mark error as resolved:', error);
    }
  }

  // Utility method to wrap async operations with error handling
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: any = {},
    projectId?: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = this.classifyError(errorMessage);

      if (projectId) {
        await this.reportError(projectId, errorType, errorMessage, context, error instanceof Error ? error.stack : undefined);
      }

      console.error('Operation failed:', error);
      return null;
    }
  }

  private classifyError(message: string): ErrorReport['errorType'] {
    if (message.includes('API') || message.includes('fetch')) {
      return 'api_error';
    }
    if (message.includes('build') || message.includes('compile')) {
      return 'build_error';
    }
    if (message.includes('auth') || message.includes('token')) {
      return 'auth_error';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network_error';
    }
    return 'runtime_error';
  }
}

export const errorHandlingService = new ErrorHandlingService();