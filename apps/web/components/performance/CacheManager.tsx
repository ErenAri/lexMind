'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Cache entry structure
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  etag?: string;
  lastModified?: string;
  size?: number;
}

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  totalSize: number;
  hitRate: number;
}

// Cache configuration
interface CacheConfig {
  maxSize: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  maxMemoryMB: number; // Maximum memory usage in MB
  compressionThreshold: number; // Compress entries larger than this size
}

interface CacheContextType {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, data: T, ttl?: number, etag?: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  getStats: () => CacheStats;
  prefetch: (keys: string[], fetcher: (key: string) => Promise<any>) => Promise<void>;
  invalidatePattern: (pattern: string) => void;
  setConfig: (config: Partial<CacheConfig>) => void;
}

const CacheContext = createContext<CacheContextType | null>(null);

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};

interface CacheProviderProps {
  children: React.ReactNode;
  config?: Partial<CacheConfig>;
}

export default function CacheProvider({ children, config: initialConfig }: CacheProviderProps) {
  const [config, setConfig] = useState<CacheConfig>({
    maxSize: 1000,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxMemoryMB: 50,
    compressionThreshold: 10000, // 10KB
    ...initialConfig
  });

  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const stats = useRef<CacheStats>({
    hits: 0,
    misses: 0,
    entries: 0,
    totalSize: 0,
    hitRate: 0
  });

  // LRU tracking
  const accessOrder = useRef<Map<string, number>>(new Map());
  const accessCounter = useRef(0);

  // Cleanup interval
  const cleanupInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Start cleanup interval
    cleanupInterval.current = setInterval(() => {
      cleanup();
    }, 60000); // Cleanup every minute

    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, []);

  const calculateSize = (data: any): number => {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate in bytes (UTF-16)
    } catch {
      return 0;
    }
  };

  const compressData = (data: any): any => {
    // Simple compression by removing whitespace from JSON
    // In production, you might want to use actual compression libraries
    try {
      if (typeof data === 'object') {
        return JSON.parse(JSON.stringify(data));
      }
      return data;
    } catch {
      return data;
    }
  };

  const isExpired = (entry: CacheEntry): boolean => {
    return Date.now() > entry.timestamp + entry.ttl;
  };

  const cleanup = useCallback(() => {
    const now = Date.now();
    let removed = 0;

    // Remove expired entries
    for (const [key, entry] of cache.current.entries()) {
      if (isExpired(entry)) {
        cache.current.delete(key);
        accessOrder.current.delete(key);
        stats.current.totalSize -= entry.size || 0;
        removed++;
      }
    }

    // Remove LRU entries if over size limit
    while (cache.current.size > config.maxSize) {
      const lruKey = getLRUKey();
      if (lruKey) {
        const entry = cache.current.get(lruKey);
        cache.current.delete(lruKey);
        accessOrder.current.delete(lruKey);
        if (entry) {
          stats.current.totalSize -= entry.size || 0;
        }
        removed++;
      } else {
        break;
      }
    }

    // Remove entries if over memory limit
    const maxMemoryBytes = config.maxMemoryMB * 1024 * 1024;
    while (stats.current.totalSize > maxMemoryBytes) {
      const lruKey = getLRUKey();
      if (lruKey) {
        const entry = cache.current.get(lruKey);
        cache.current.delete(lruKey);
        accessOrder.current.delete(lruKey);
        if (entry) {
          stats.current.totalSize -= entry.size || 0;
        }
        removed++;
      } else {
        break;
      }
    }

    stats.current.entries = cache.current.size;
    
    if (removed > 0) {
      console.log(`Cache cleanup: removed ${removed} entries`);
    }
  }, [config.maxSize, config.maxMemoryMB]);

  const getLRUKey = (): string | null => {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, access] of accessOrder.current.entries()) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    return lruKey;
  };

  const updateAccessTime = (key: string) => {
    accessOrder.current.set(key, ++accessCounter.current);
  };

  const get = useCallback(<T>(key: string): T | null => {
    const entry = cache.current.get(key);
    
    if (!entry) {
      stats.current.misses++;
      return null;
    }

    if (isExpired(entry)) {
      cache.current.delete(key);
      accessOrder.current.delete(key);
      stats.current.totalSize -= entry.size || 0;
      stats.current.entries = cache.current.size;
      stats.current.misses++;
      return null;
    }

    updateAccessTime(key);
    stats.current.hits++;
    stats.current.hitRate = stats.current.hits / (stats.current.hits + stats.current.misses);
    
    return entry.data as T;
  }, []);

  const set = useCallback(<T>(key: string, data: T, ttl?: number, etag?: string) => {
    const size = calculateSize(data);
    const shouldCompress = size > config.compressionThreshold;
    const processedData = shouldCompress ? compressData(data) : data;

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: ttl || config.defaultTTL,
      etag,
      size: calculateSize(processedData)
    };

    // Remove existing entry if it exists
    const existingEntry = cache.current.get(key);
    if (existingEntry) {
      stats.current.totalSize -= existingEntry.size || 0;
    }

    cache.current.set(key, entry);
    updateAccessTime(key);
    
    stats.current.totalSize += entry.size || 0;
    stats.current.entries = cache.current.size;

    // Trigger cleanup if needed
    if (cache.current.size > config.maxSize || 
        stats.current.totalSize > config.maxMemoryMB * 1024 * 1024) {
      cleanup();
    }
  }, [config.defaultTTL, config.compressionThreshold, config.maxSize, config.maxMemoryMB, cleanup]);

  const remove = useCallback((key: string) => {
    const entry = cache.current.get(key);
    if (entry) {
      cache.current.delete(key);
      accessOrder.current.delete(key);
      stats.current.totalSize -= entry.size || 0;
      stats.current.entries = cache.current.size;
    }
  }, []);

  const clear = useCallback(() => {
    cache.current.clear();
    accessOrder.current.clear();
    stats.current = {
      hits: 0,
      misses: 0,
      entries: 0,
      totalSize: 0,
      hitRate: 0
    };
  }, []);

  const getStats = useCallback((): CacheStats => {
    return { ...stats.current };
  }, []);

  const prefetch = useCallback(async (keys: string[], fetcher: (key: string) => Promise<any>) => {
    const promises = keys.map(async (key) => {
      if (!cache.current.has(key) || isExpired(cache.current.get(key)!)) {
        try {
          const data = await fetcher(key);
          set(key, data);
        } catch (error) {
          console.warn(`Failed to prefetch ${key}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }, [set]);

  const invalidatePattern = useCallback((pattern: string) => {
    const regex = new RegExp(pattern);
    const keysToRemove: string[] = [];

    for (const key of cache.current.keys()) {
      if (regex.test(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => remove(key));
  }, [remove]);

  const updateConfig = useCallback((newConfig: Partial<CacheConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    
    // Trigger cleanup if limits were reduced
    if (newConfig.maxSize && newConfig.maxSize < cache.current.size) {
      cleanup();
    }
  }, [cleanup]);

  return (
    <CacheContext.Provider value={{
      get,
      set,
      remove,
      clear,
      getStats,
      prefetch,
      invalidatePattern,
      setConfig: updateConfig
    }}>
      {children}
    </CacheContext.Provider>
  );
}