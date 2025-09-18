// performance.js - Add this as a new file
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.setupObservers();
  }

  setupObservers() {
    // Memory usage monitoring
    if ('memory' in performance) {
      this.startMemoryMonitoring();
    }

    // Long task monitoring
    if ('PerformanceObserver' in window) {
      this.setupLongTaskObserver();
      this.setupLayoutShiftObserver();
    }

    // Frame rate monitoring
    this.startFrameRateMonitoring();
  }

  startMemoryMonitoring() {
    const checkMemory = () => {
      const memory = performance.memory;
      this.recordMetric('memory', {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      });

      // Warn if memory usage is high
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
      }
    };

    // Check every 30 seconds
    setInterval(checkMemory, 30000);
    checkMemory(); // Initial check
  }

  setupLongTaskObserver() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
            this.recordMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              timestamp: Date.now()
            });
          }
        });
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.set('longtask', observer);
    } catch (error) {
      console.warn('Long task observer not supported:', error);
    }
  }

  setupLayoutShiftObserver() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.value > 0.1) { // Significant layout shift
            console.warn(`Layout shift detected: ${entry.value.toFixed(4)}`);
            this.recordMetric('layoutShift', {
              value: entry.value,
              startTime: entry.startTime,
              timestamp: Date.now()
            });
          }
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('layout-shift', observer);
    } catch (error) {
      console.warn('Layout shift observer not supported:', error);
    }
  }

  startFrameRateMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;

    const measureFPS = (currentTime) => {
      frameCount++;
      const elapsed = currentTime - lastTime;

      if (elapsed >= 1000) { // Every second
        fps = Math.round((frameCount * 1000) / elapsed);
        this.recordMetric('fps', {
          value: fps,
          timestamp: Date.now()
        });

        if (fps < 30) {
          console.warn(`Low FPS detected: ${fps}`);
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metric = this.metrics.get(name);
    metric.push(data);

    // Keep only last 100 entries per metric
    if (metric.length > 100) {
      metric.splice(0, metric.length - 100);
    }
  }

  // Performance timing helpers
  startTiming(label) {
    performance.mark(`${label}-start`);
  }

  endTiming(label) {
    try {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      
      const measure = performance.getEntriesByName(label, 'measure')[0];
      if (measure) {
        this.recordMetric('timing', {
          label,
          duration: measure.duration,
          timestamp: Date.now()
        });

        if (measure.duration > 100) {
          console.warn(`Slow operation: ${label} took ${measure.duration.toFixed(2)}ms`);
        }
      }

      // Clean up marks
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);
    } catch (error) {
      console.error('Performance timing failed:', error);
    }
  }

  getMetrics() {
    const summary = {};
    
    this.metrics.forEach((values, key) => {
      if (values.length > 0) {
        const latest = values[values.length - 1];
        
        switch (key) {
          case 'memory':
            summary[key] = {
              used: `${(latest.used / 1024 / 1024).toFixed(1)}MB`,
              total: `${(latest.total / 1024 / 1024).toFixed(1)}MB`,
              usage: `${((latest.used / latest.total) * 100).toFixed(1)}%`
            };
            break;
          case 'fps':
            summary[key] = latest.value;
            break;
          case 'timing':
            const timings = values.slice(-10); // Last 10 timings
            const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
            summary[key] = {
              average: `${avgDuration.toFixed(2)}ms`,
              count: timings.length
            };
            break;
          default:
            summary[key] = values.length;
        }
      }
    });

    return summary;
  }

  // Cleanup method
  cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    
    this.observers.clear();
    this.metrics.clear();
  }
}

// Create global instance
export const performanceMonitor = new PerformanceMonitor();

// Add to window for debugging
if (typeof window !== 'undefined') {
  window.performanceMonitor = performanceMonitor;
}

// Helper function to wrap operations with timing
export function withTiming(label, fn) {
  return function(...args) {
    performanceMonitor.startTiming(label);
    
    try {
      const result = fn.apply(this, args);
      
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.endTiming(label);
        });
      } else {
        performanceMonitor.endTiming(label);
        return result;
      }
    } catch (error) {
      performanceMonitor.endTiming(label);
      throw error;
    }
  };
}