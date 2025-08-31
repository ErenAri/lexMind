'use client';

import React from 'react';
import { useCache } from './CacheManager';
import { usePerformance } from './PerformanceMonitor';

// Request deduplication map
const pendingRequests = new Map<string, Promise<Response>>();

// Request queue for batching
const requestQueue = new Map<string, Array<{
  resolve: (value: any) => void;
  reject: (error: any) => void;
  options: RequestInit;
}>>();

// Batch processing delay
const BATCH_DELAY = 50; // ms

interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableCaching?: boolean;
  enableBatching?: boolean;
  enableDeduplication?: boolean;
}

interface RequestOptions extends RequestInit {
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
  timeout?: number;
  batch?: boolean;
  dedupe?: boolean;
}

class OptimizedApiClient {
  private config: ApiClientConfig;
  private cache: any;
  private performance: any;

  constructor(config: ApiClientConfig, cache?: any, performance?: any) {
    this.config = config;
    this.cache = cache;
    this.performance = performance;
  }

  // Generate cache key for request
  private generateCacheKey(url: string, options: RequestOptions): string {
    const method = options.method || 'GET';
    const headers = JSON.stringify(options.headers || {});
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${headers}:${body}`;
  }

  // Check if request is cacheable
  private isCacheable(method: string): boolean {
    return ['GET', 'HEAD'].includes(method.toUpperCase());
  }

  // Add request to batch queue
  private addToBatch(url: string, options: RequestOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchKey = `${options.method || 'GET'}:${url}`;
      
      if (!requestQueue.has(batchKey)) {
        requestQueue.set(batchKey, []);
        
        // Process batch after delay
        setTimeout(() => {
          this.processBatch(batchKey);
        }, BATCH_DELAY);
      }

      requestQueue.get(batchKey)!.push({ resolve, reject, options });
    });
  }

  // Process batched requests
  private async processBatch(batchKey: string) {
    const requests = requestQueue.get(batchKey);
    if (!requests || requests.length === 0) return;

    requestQueue.delete(batchKey);

    // If only one request, process normally
    if (requests.length === 1) {
      const { resolve, reject, options } = requests[0];
      try {
        const [, url] = batchKey.split(':', 2);
        const result = await this.executeRequest(url, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
      return;
    }

    // Multiple requests - create batch request
    try {
      const batchData = requests.map((req, index) => ({
        id: index,
        method: req.options.method || 'GET',
        url: batchKey.split(':', 2)[1],
        headers: req.options.headers,
        body: req.options.body
      }));

      const batchResponse = await this.executeRequest('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: batchData })
      });

      // Distribute results to original promises
      if (batchResponse && Array.isArray(batchResponse.results)) {
        batchResponse.results.forEach((result: any, index: number) => {
          if (requests[index]) {
            if (result.error) {
              requests[index].reject(new Error(result.error));
            } else {
              requests[index].resolve(result.data);
            }
          }
        });
      }
    } catch (error) {
      // If batch fails, reject all requests
      requests.forEach(req => req.reject(error));
    }
  }

  // Execute the actual HTTP request
  private async executeRequest(url: string, options: RequestOptions): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    const timeout = options.timeout || this.config.timeout || 10000;
    
    // Start performance measurement
    const endMeasurement = this.performance?.startMeasurement(`api:${url}`);
    const startTime = performance.now();

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Merge headers
      const headers = {
        ...this.config.defaultHeaders,
        ...options.headers
      };

      // Make request
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Record API response time
      const responseTime = performance.now() - startTime;
      this.performance?.recordApiCall(url, responseTime);
      endMeasurement?.();

      // Handle response
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      endMeasurement?.();
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  // Main request method with all optimizations
  async request(url: string, options: RequestOptions = {}): Promise<any> {
    const method = options.method || 'GET';
    const cacheKey = this.generateCacheKey(url, options);
    
    // Check cache first (for cacheable requests)
    if (options.cache !== false && 
        this.config.enableCaching && 
        this.cache && 
        this.isCacheable(method)) {
      
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // Check for duplicate requests
    if (options.dedupe !== false && 
        this.config.enableDeduplication && 
        pendingRequests.has(cacheKey)) {
      
      const pendingRequest = pendingRequests.get(cacheKey)!;
      return pendingRequest.then(response => response.clone().json());
    }

    // Use batching for eligible requests
    if (options.batch !== false && 
        this.config.enableBatching && 
        method === 'GET') {
      
      return this.addToBatch(url, options);
    }

    // Execute request with retries
    let lastError: Error | null = null;
    const maxRetries = options.retries ?? this.config.retries ?? 3;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create promise for deduplication
        const requestPromise = this.executeRequest(url, options);
        
        if (options.dedupe !== false && this.config.enableDeduplication) {
          pendingRequests.set(cacheKey, requestPromise as any);
        }

        const data = await requestPromise;

        // Clean up pending request
        pendingRequests.delete(cacheKey);

        // Cache successful response
        if (options.cache !== false && 
            this.config.enableCaching && 
            this.cache && 
            this.isCacheable(method)) {
          
          this.cache.set(cacheKey, data, options.cacheTTL);
        }

        return data;

      } catch (error) {
        lastError = error as Error;
        pendingRequests.delete(cacheKey);

        // Don't retry on certain errors
        if (error.message.includes('400') || 
            error.message.includes('401') || 
            error.message.includes('403') || 
            error.message.includes('404')) {
          break;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  // Specialized methods
  async get(url: string, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url: string, data?: any, options: RequestOptions = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put(url: string, data?: any, options: RequestOptions = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch(url: string, data?: any, options: RequestOptions = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete(url: string, options: RequestOptions = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  // Cache management
  clearCache(pattern?: string) {
    if (this.cache) {
      if (pattern) {
        this.cache.invalidatePattern(pattern);
      } else {
        this.cache.clear();
      }
    }
  }

  // Prefetch data
  async prefetch(urls: string[], options: RequestOptions = {}) {
    if (this.cache) {
      await this.cache.prefetch(urls, (url) => this.request(url, options));
    }
  }
}

// React hook for optimized API client
export function useOptimizedApiClient(config: ApiClientConfig) {
  const cache = useCache();
  const performance = usePerformance();

  return React.useMemo(() => {
    return new OptimizedApiClient(config, cache, performance);
  }, [config, cache, performance]);
}

export default OptimizedApiClient;