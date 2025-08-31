'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// Performance metrics
interface PerformanceMetrics {
  // Page load metrics
  domContentLoaded?: number;
  loadComplete?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  
  // Runtime metrics
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  
  // Custom metrics
  apiResponseTimes: Map<string, number[]>;
  renderTimes: Map<string, number>;
  errorCount: number;
  
  // User interaction metrics
  clickCount: number;
  scrollDepth: number;
  timeOnPage: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

interface PerformanceConfig {
  enabled: boolean;
  sampling: number; // 0-1, percentage of users to monitor
  thresholds: {
    lcpThreshold: number; // Largest Contentful Paint (ms)
    fidThreshold: number; // First Input Delay (ms)
    clsThreshold: number; // Cumulative Layout Shift
    apiResponseThreshold: number; // API response time (ms)
    memoryThreshold: number; // Memory usage percentage
  };
  reportingInterval: number; // How often to report metrics (ms)
}

interface PerformanceContextType {
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  config: PerformanceConfig;
  startMeasurement: (name: string) => () => number;
  recordApiCall: (endpoint: string, responseTime: number) => void;
  recordError: (error: Error, context?: string) => void;
  getPerformanceReport: () => any;
  updateConfig: (config: Partial<PerformanceConfig>) => void;
  clearAlerts: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: React.ReactNode;
  config?: Partial<PerformanceConfig>;
}

export default function PerformanceProvider({ children, config: initialConfig }: PerformanceProviderProps) {
  const [config, setConfig] = useState<PerformanceConfig>({
    enabled: true,
    sampling: 1.0,
    thresholds: {
      lcpThreshold: 2500,
      fidThreshold: 100,
      clsThreshold: 0.1,
      apiResponseThreshold: 1000,
      memoryThreshold: 0.8
    },
    reportingInterval: 30000,
    ...initialConfig
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    apiResponseTimes: new Map(),
    renderTimes: new Map(),
    errorCount: 0,
    clickCount: 0,
    scrollDepth: 0,
    timeOnPage: 0
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const measurementMap = useRef<Map<string, number>>(new Map());
  const observer = useRef<PerformanceObserver | null>(null);
  const memoryInterval = useRef<NodeJS.Timeout>();
  const reportingInterval = useRef<NodeJS.Timeout>();
  const pageStartTime = useRef<number>(Date.now());

  // Check if we should monitor this user based on sampling rate
  const shouldMonitor = useRef<boolean>(Math.random() < config.sampling);

  useEffect(() => {
    if (!config.enabled || !shouldMonitor.current) return;

    initializePerformanceMonitoring();
    setupEventListeners();
    startMemoryMonitoring();
    startReporting();

    return () => {
      cleanup();
    };
  }, [config.enabled]);

  const initializePerformanceMonitoring = () => {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      // Observe paint metrics
      observer.current = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const alertId = Date.now().toString();

          switch (entry.entryType) {
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                setMetrics(prev => ({ ...prev, firstContentfulPaint: entry.startTime }));
              }
              break;

            case 'largest-contentful-paint':
              setMetrics(prev => ({ ...prev, largestContentfulPaint: entry.startTime }));
              
              if (entry.startTime > config.thresholds.lcpThreshold) {
                addAlert({
                  id: alertId,
                  type: 'warning',
                  metric: 'LCP',
                  value: entry.startTime,
                  threshold: config.thresholds.lcpThreshold,
                  timestamp: Date.now(),
                  message: `Largest Contentful Paint is slow: ${entry.startTime.toFixed(0)}ms`
                });
              }
              break;

            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                const currentCLS = metrics.cumulativeLayoutShift || 0;
                const newCLS = currentCLS + (entry as any).value;
                setMetrics(prev => ({ ...prev, cumulativeLayoutShift: newCLS }));

                if (newCLS > config.thresholds.clsThreshold) {
                  addAlert({
                    id: alertId,
                    type: 'warning',
                    metric: 'CLS',
                    value: newCLS,
                    threshold: config.thresholds.clsThreshold,
                    timestamp: Date.now(),
                    message: `Cumulative Layout Shift is high: ${newCLS.toFixed(3)}`
                  });
                }
              }
              break;

            case 'first-input':
              const fidValue = entry.processingStart - entry.startTime;
              setMetrics(prev => ({ ...prev, firstInputDelay: fidValue }));

              if (fidValue > config.thresholds.fidThreshold) {
                addAlert({
                  id: alertId,
                  type: 'warning',
                  metric: 'FID',
                  value: fidValue,
                  threshold: config.thresholds.fidThreshold,
                  timestamp: Date.now(),
                  message: `First Input Delay is slow: ${fidValue.toFixed(0)}ms`
                });
              }
              break;

            case 'navigation':
              const navEntry = entry as PerformanceNavigationTiming;
              setMetrics(prev => ({
                ...prev,
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
                loadComplete: navEntry.loadEventEnd - navEntry.navigationStart
              }));
              break;
          }
        });
      });

      // Observe multiple entry types
      observer.current.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input', 'navigation'] });
    } catch (error) {
      console.warn('Failed to initialize PerformanceObserver:', error);
    }
  };

  const setupEventListeners = () => {
    // Track clicks
    const handleClick = () => {
      setMetrics(prev => ({ ...prev, clickCount: prev.clickCount + 1 }));
    };

    // Track scroll depth
    const handleScroll = () => {
      const scrollDepth = Math.max(0, Math.min(1, 
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight
      ));
      setMetrics(prev => ({ ...prev, scrollDepth: Math.max(prev.scrollDepth, scrollDepth) }));
    };

    // Track errors
    const handleError = (event: ErrorEvent) => {
      recordError(new Error(event.message), `${event.filename}:${event.lineno}`);
    };

    // Track unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recordError(new Error(String(event.reason)), 'Unhandled Promise Rejection');
    };

    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  };

  const startMemoryMonitoring = () => {
    if (!('memory' in performance)) return;

    memoryInterval.current = setInterval(() => {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        const usage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        
        setMetrics(prev => ({
          ...prev,
          memoryUsage: {
            usedJSHeapSize: memoryInfo.usedJSHeapSize,
            totalJSHeapSize: memoryInfo.totalJSHeapSize,
            jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit
          }
        }));

        if (usage > config.thresholds.memoryThreshold) {
          addAlert({
            id: Date.now().toString(),
            type: 'warning',
            metric: 'Memory',
            value: usage,
            threshold: config.thresholds.memoryThreshold,
            timestamp: Date.now(),
            message: `High memory usage: ${(usage * 100).toFixed(1)}%`
          });
        }
      }
    }, 5000);
  };

  const startReporting = () => {
    reportingInterval.current = setInterval(() => {
      const timeOnPage = Date.now() - pageStartTime.current;
      setMetrics(prev => ({ ...prev, timeOnPage }));

      // Optional: Send metrics to analytics service
      if (config.reportingInterval > 0) {
        const report = getPerformanceReport();
        console.log('Performance Report:', report);
        // Here you could send to your analytics service
      }
    }, config.reportingInterval);
  };

  const cleanup = () => {
    if (observer.current) {
      observer.current.disconnect();
    }
    if (memoryInterval.current) {
      clearInterval(memoryInterval.current);
    }
    if (reportingInterval.current) {
      clearInterval(reportingInterval.current);
    }
  };

  const addAlert = (alert: PerformanceAlert) => {
    setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts
  };

  const startMeasurement = useCallback((name: string) => {
    const startTime = performance.now();
    measurementMap.current.set(name, startTime);

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      setMetrics(prev => ({
        ...prev,
        renderTimes: new Map(prev.renderTimes).set(name, duration)
      }));

      measurementMap.current.delete(name);
      return duration;
    };
  }, []);

  const recordApiCall = useCallback((endpoint: string, responseTime: number) => {
    setMetrics(prev => {
      const newApiTimes = new Map(prev.apiResponseTimes);
      const existing = newApiTimes.get(endpoint) || [];
      existing.push(responseTime);
      
      // Keep only last 100 measurements per endpoint
      if (existing.length > 100) {
        existing.shift();
      }
      
      newApiTimes.set(endpoint, existing);
      
      return {
        ...prev,
        apiResponseTimes: newApiTimes
      };
    });

    if (responseTime > config.thresholds.apiResponseThreshold) {
      addAlert({
        id: Date.now().toString(),
        type: 'warning',
        metric: 'API Response',
        value: responseTime,
        threshold: config.thresholds.apiResponseThreshold,
        timestamp: Date.now(),
        message: `Slow API response for ${endpoint}: ${responseTime.toFixed(0)}ms`
      });
    }
  }, [config.thresholds.apiResponseThreshold]);

  const recordError = useCallback((error: Error, context?: string) => {
    setMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    
    addAlert({
      id: Date.now().toString(),
      type: 'error',
      metric: 'Error',
      value: 1,
      threshold: 0,
      timestamp: Date.now(),
      message: `${error.message}${context ? ` (${context})` : ''}`
    });
  }, []);

  const getPerformanceReport = useCallback(() => {
    const apiStats = {};
    metrics.apiResponseTimes.forEach((times, endpoint) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      apiStats[endpoint] = { average: avg, p95, calls: times.length };
    });

    return {
      timestamp: Date.now(),
      pageLoad: {
        domContentLoaded: metrics.domContentLoaded,
        loadComplete: metrics.loadComplete,
        firstContentfulPaint: metrics.firstContentfulPaint,
        largestContentfulPaint: metrics.largestContentfulPaint,
        cumulativeLayoutShift: metrics.cumulativeLayoutShift,
        firstInputDelay: metrics.firstInputDelay
      },
      runtime: {
        memoryUsage: metrics.memoryUsage,
        errorCount: metrics.errorCount,
        apiStats
      },
      userEngagement: {
        clickCount: metrics.clickCount,
        scrollDepth: metrics.scrollDepth,
        timeOnPage: metrics.timeOnPage
      },
      alerts: alerts.length
    };
  }, [metrics, alerts]);

  const updateConfig = useCallback((newConfig: Partial<PerformanceConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <PerformanceContext.Provider value={{
      metrics,
      alerts,
      config,
      startMeasurement,
      recordApiCall,
      recordError,
      getPerformanceReport,
      updateConfig,
      clearAlerts
    }}>
      {children}
    </PerformanceContext.Provider>
  );
}