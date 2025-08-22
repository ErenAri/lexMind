'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle,
  Home,
  RefreshCw,
  Bug,
  ArrowLeft
} from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to monitoring service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-danger-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
            <div className="text-xl font-bold">L</div>
          </div>
          <div className="ml-3 text-2xl font-bold text-gradient">LexMind</div>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-danger-600" />
          </div>
          
          <h1 className="text-2xl font-semibold text-secondary-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-secondary-600 mb-6">
            We encountered an unexpected error. This has been logged and our team will investigate.
          </p>
          
          {/* Error Details for Development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-left mb-6">
              <h3 className="font-medium text-danger-900 mb-2 flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Error Details (Development)
              </h3>
              <pre className="text-xs text-danger-800 whitespace-pre-wrap font-mono">
                {error.message}
              </pre>
              {error.digest && (
                <p className="text-xs text-danger-600 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <button
            onClick={reset}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="btn btn-outline w-full flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>

        {/* Suggestions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">
            What you can try:
          </h3>
          <div className="space-y-3 text-sm text-left">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
              <p>Refresh the page or try again</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
              <p>Check your internet connection</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
              <p>Clear your browser cache and cookies</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
              <p>Try using a different browser</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="text-sm text-secondary-600 hover:text-secondary-900 flex items-center justify-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back to previous page
          </button>
        </div>

        {/* Contact Support */}
        <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <p className="text-sm text-primary-700">
            <strong>Still having issues?</strong> Contact our support team with error ID: {error.digest || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}