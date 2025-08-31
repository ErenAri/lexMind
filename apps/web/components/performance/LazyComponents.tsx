'use client';

import React, { Suspense, lazy, ComponentType, ReactNode } from 'react';
import { InlineLoading } from '../LoadingStates';

// Higher-order component for lazy loading with custom loading state
interface LazyWrapperProps {
  fallback?: ReactNode;
  error?: ComponentType<{ error: Error; retry: () => void }>;
  delay?: number;
}

export function withLazyLoading<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: LazyWrapperProps = {}
) {
  const LazyComponent = lazy(importFunc);
  
  const WrappedComponent: React.FC<P> = (props) => {
    const { fallback, error: ErrorComponent, delay = 0 } = options;
    
    // Default fallback component
    const defaultFallback = (
      <div className="flex items-center justify-center p-8">
        <InlineLoading size="lg" />
      </div>
    );

    // Error boundary component
    class LazyErrorBoundary extends React.Component<
      { children: ReactNode; ErrorComponent?: ComponentType<any> },
      { hasError: boolean; error: Error | null }
    > {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      render() {
        if (this.state.hasError && this.state.error) {
          if (this.props.ErrorComponent) {
            return (
              <this.props.ErrorComponent 
                error={this.state.error} 
                retry={() => this.setState({ hasError: false, error: null })}
              />
            );
          }
          
          return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-red-800 font-medium">Failed to load component</h3>
              <p className="text-red-700 text-sm mt-1">{this.state.error.message}</p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          );
        }

        return this.props.children;
      }
    }

    return (
      <LazyErrorBoundary ErrorComponent={ErrorComponent}>
        <Suspense fallback={fallback || defaultFallback}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyErrorBoundary>
    );
  };

  WrappedComponent.displayName = `LazyWrapped(${LazyComponent.displayName || 'Component'})`;
  return WrappedComponent;
}

// Pre-configured lazy components for common patterns
export const LazyDocumentLibrary = withLazyLoading(
  () => import('../documents/DocumentLibrary'),
  {
    fallback: (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
);

export const LazyComplianceDashboard = withLazyLoading(
  () => import('../ComplianceDashboard'),
  {
    fallback: (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }
);

export const LazyDocumentVersionHistory = withLazyLoading(
  () => import('../versioning/DocumentVersionHistory'),
  {
    fallback: (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
);

export const LazyCollaborationPanel = withLazyLoading(
  () => import('../collaboration/CollaborationPanel'),
  {
    fallback: (
      <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded flex-1"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
);

// Intersection Observer hook for lazy loading on scroll
export function useInView(threshold: number = 0.1) {
  const [isInView, setIsInView] = React.useState(false);
  const [ref, setRef] = React.useState<Element | null>(null);

  React.useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold }
    );

    observer.observe(ref);

    return () => {
      observer.disconnect();
    };
  }, [ref, threshold]);

  return [setRef, isInView] as const;
}

// Component for lazy loading content when it comes into view
interface LazyOnScrollProps {
  children: ReactNode;
  fallback?: ReactNode;
  threshold?: number;
  className?: string;
}

export function LazyOnScroll({ 
  children, 
  fallback, 
  threshold = 0.1, 
  className 
}: LazyOnScrollProps) {
  const [ref, isInView] = useInView(threshold);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    if (isInView) {
      setHasLoaded(true);
    }
  }, [isInView]);

  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <InlineLoading size="md" />
        <p className="text-sm text-gray-600 mt-2">Loading content...</p>
      </div>
    </div>
  );

  return (
    <div ref={ref} className={className}>
      {hasLoaded ? children : (fallback || defaultFallback)}
    </div>
  );
}

// Virtual scrolling for large lists
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Image lazy loading component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}

export function LazyImage({ src, alt, placeholder, className, ...props }: LazyImageProps) {
  const [imageSrc, setImageSrc] = React.useState(placeholder);
  const [imageRef, setImageRef] = React.useState<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  React.useEffect(() => {
    if (!imageRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imageRef);

    return () => {
      observer.disconnect();
    };
  }, [imageRef, src]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-50'} ${className}`}
      onLoad={() => setIsLoaded(true)}
      onError={() => setIsError(true)}
      {...props}
    />
  );
}