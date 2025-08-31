'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-danger-600" />
            </div>
            
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-secondary-600 mb-6">
              This component encountered an unexpected error. Please try refreshing or go back to the dashboard.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-left mb-6">
                <h3 className="font-medium text-danger-900 mb-2">
                  Error Details (Development)
                </h3>
                <pre className="text-xs text-danger-800 whitespace-pre-wrap font-mono">
                  {this.state.error.message}
                </pre>
                <pre className="text-xs text-danger-600 mt-2 whitespace-pre-wrap font-mono">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="btn btn-outline w-full flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}