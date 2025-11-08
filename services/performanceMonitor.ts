interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  context?: any;
}

interface PerformanceReport {
  period: {
    start: number;
    end: number;
  };
  metrics: {
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    networkRequests: number;
    slowestOperations: Array<{ name: string; duration: number; timestamp: number }>;
  };
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private observers: Array<(metric: PerformanceMetric) => void> = [];

  // Track operation performance
  async trackOperation<T>(
    name: string,
    operation: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      this.recordMetric({
        id: `${name}-${Date.now()}`,
        name: `${name}_success`,
        value: duration,
        timestamp: Date.now(),
        context: { ...context, success: true }
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.recordMetric({
        id: `${name}-${Date.now()}`,
        name: `${name}_error`,
        value: duration,
        timestamp: Date.now(),
        context: { ...context, success: false, error: error instanceof Error ? error.message : String(error) }
      });

      throw error;
    }
  }

  // Record a custom metric
  recordMetric(metric: Omit<PerformanceMetric, 'id'> & { id?: string }): void {
    const fullMetric: PerformanceMetric = {
      id: metric.id || `${metric.name}-${Date.now()}`,
      ...metric
    };

    this.metrics.push(fullMetric);

    // Maintain max metrics limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Notify observers
    this.observers.forEach(observer => observer(fullMetric));
  }

  // Get metrics for a specific time range
  getMetrics(
    name?: string,
    startTime?: number,
    endTime?: number
  ): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }

    return filtered;
  }

  // Generate performance report
  generateReport(hours: number = 24): PerformanceReport {
    const endTime = Date.now();
    const startTime = endTime - (hours * 60 * 60 * 1000);

    const periodMetrics = this.getMetrics(undefined, startTime, endTime);

    // Calculate averages
    const responseTimes = periodMetrics.filter(m => !m.name.includes('_error'));
    const errors = periodMetrics.filter(m => m.name.includes('_error'));

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, m) => sum + m.value, 0) / responseTimes.length
      : 0;

    const errorRate = periodMetrics.length > 0
      ? (errors.length / periodMetrics.length) * 100
      : 0;

    // Memory usage (if available)
    const memoryUsage = (performance as any).memory
      ? (performance as any).memory.usedJSHeapSize / (1024 * 1024) // MB
      : 0;

    // Network requests (rough estimate from fetch operations)
    const networkRequests = periodMetrics.filter(m =>
      m.name.includes('api') || m.name.includes('fetch')
    ).length;

    // Find slowest operations
    const slowestOperations = [...responseTimes]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(m => ({
        name: m.name,
        duration: m.value,
        timestamp: m.timestamp
      }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (averageResponseTime > 2000) {
      recommendations.push('Consider optimizing slow operations (>2s average response time)');
    }

    if (errorRate > 10) {
      recommendations.push('High error rate detected (>10%). Review error handling and API stability.');
    }

    if (memoryUsage > 100) {
      recommendations.push('High memory usage detected (>100MB). Consider memory optimization.');
    }

    if (slowestOperations.length > 0 && slowestOperations[0].duration > 5000) {
      recommendations.push(`Critical performance issue: ${slowestOperations[0].name} taking ${slowestOperations[0].duration.toFixed(0)}ms`);
    }

    return {
      period: { start: startTime, end: endTime },
      metrics: {
        averageResponseTime,
        errorRate,
        memoryUsage,
        networkRequests,
        slowestOperations
      },
      recommendations
    };
  }

  // Monitor Web Vitals
  startWebVitalsMonitoring(): void {
    if (typeof window !== 'undefined' && 'web-vitals' in window) {
      // This would require the web-vitals library
      // For now, we'll track basic metrics
      this.recordMetric({
        name: 'page_load',
        value: performance.now(),
        timestamp: Date.now(),
        context: { type: 'web_vitals' }
      });
    }
  }

  // Monitor memory usage
  startMemoryMonitoring(intervalMs: number = 30000): () => void {
    const interval = setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        this.recordMetric({
          name: 'memory_usage',
          value: memory.usedJSHeapSize,
          timestamp: Date.now(),
          context: {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          }
        });
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  // Add observer for real-time monitoring
  addObserver(observer: (metric: PerformanceMetric) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  // Export metrics for analysis
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  // Clear old metrics
  clearOldMetrics(olderThanHours: number = 24): number {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const initialLength = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    return initialLength - this.metrics.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();