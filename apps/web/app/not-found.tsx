'use client';

import Link from 'next/link';
import { 
  Home,
  Search,
  ArrowLeft,
  MessageCircle,
  FileText,
  Settings
} from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
            <div className="text-xl font-bold">L</div>
          </div>
          <div className="ml-3 text-2xl font-bold text-gradient">LexMind</div>
        </div>

        {/* 404 Message */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-secondary-900 mb-2">
            Page Not Found
          </h2>
          <p className="text-secondary-600 mb-6">
            Sorry, we couldn't find the page you're looking for. 
            The page might have been moved, deleted, or the URL might be incorrect.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <Link
            href="/"
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
          
          <Link
            href="/search"
            className="btn btn-outline w-full flex items-center justify-center gap-2"
          >
            <Search className="h-4 w-4" />
            Search Documents
          </Link>
        </div>

        {/* Quick Links */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">
            Popular Pages
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/chat"
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary-50 transition-colors group"
            >
              <MessageCircle className="h-6 w-6 text-primary-600 group-hover:text-primary-700" />
              <span className="text-sm font-medium text-secondary-700 group-hover:text-secondary-900">
                AI Chat
              </span>
            </Link>
            
            <Link
              href="/documents"
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary-50 transition-colors group"
            >
              <FileText className="h-6 w-6 text-primary-600 group-hover:text-primary-700" />
              <span className="text-sm font-medium text-secondary-700 group-hover:text-secondary-900">
                Documents
              </span>
            </Link>
            
            <Link
              href="/settings"
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary-50 transition-colors group"
            >
              <Settings className="h-6 w-6 text-primary-600 group-hover:text-primary-700" />
              <span className="text-sm font-medium text-secondary-700 group-hover:text-secondary-900">
                Settings
              </span>
            </Link>
            
            <Link
              href="/profile"
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary-50 transition-colors group"
            >
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center group-hover:bg-primary-200">
                <div className="text-xs font-bold text-primary-600">U</div>
              </div>
              <span className="text-sm font-medium text-secondary-700 group-hover:text-secondary-900">
                Profile
              </span>
            </Link>
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

        {/* Help Text */}
        <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <p className="text-sm text-primary-700">
            <strong>Need help?</strong> If you believe this page should exist, 
            please contact support or check if you have the correct permissions to access this resource.
          </p>
        </div>
      </div>
    </div>
  );
}