'use client'

import React from 'react'
import { 
  Loader2, 
  FileText, 
  Search, 
  Bot,
  Database,
  Upload,
  Download,
  Sparkles,
  RefreshCw
} from 'lucide-react'

// Full page loading overlay
export const FullPageLoading: React.FC<{ 
  message?: string 
  submessage?: string 
}> = ({ 
  message = "Loading...", 
  submessage 
}) => (
  <div className="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      {submessage && (
        <p className="text-sm text-gray-600">{submessage}</p>
      )}
    </div>
  </div>
)

// Card loading skeleton
export const CardLoadingSkeleton: React.FC<{ 
  count?: number 
  height?: string 
}> = ({ 
  count = 3, 
  height = "h-32" 
}) => (
  <div className="space-y-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} className={`bg-white p-6 rounded-lg border border-gray-200 ${height} animate-pulse`}>
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    ))}
  </div>
)

// Table loading skeleton
export const TableLoadingSkeleton: React.FC<{ 
  rows?: number 
  columns?: number 
}> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    {/* Header */}
    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {[...Array(columns)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
    
    {/* Rows */}
    <div className="divide-y divide-gray-200">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="px-6 py-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {[...Array(columns)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Search loading state
export const SearchLoading: React.FC<{ 
  message?: string 
}> = ({ 
  message = "Searching..." 
}) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <div className="relative mb-4">
        <Search className="h-8 w-8 text-blue-600 mx-auto animate-pulse" />
        <div className="absolute inset-0 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  </div>
)

// Document processing loading
export const DocumentProcessingLoading: React.FC<{ 
  fileName?: string
  progress?: number 
}> = ({ 
  fileName, 
  progress 
}) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <div className="relative">
          <FileText className="h-6 w-6 text-blue-600" />
          <div className="absolute inset-0 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-blue-900">
          Processing Document
        </h4>
        <p className="text-sm text-blue-700">
          {fileName || 'Analyzing content and extracting insights...'}
        </p>
        {progress !== undefined && (
          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  </div>
)

// AI processing loading
export const AIProcessingLoading: React.FC<{ 
  task?: string 
  animated?: boolean 
}> = ({ 
  task = "AI is analyzing...", 
  animated = true 
}) => (
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <Bot className={`h-6 w-6 text-purple-600 ${animated ? 'animate-pulse' : ''}`} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-purple-900">
          AI Processing
        </h4>
        <p className="text-sm text-purple-700">{task}</p>
      </div>
      <div className="flex-shrink-0">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  </div>
)

// Upload loading state
export const UploadLoading: React.FC<{ 
  fileName: string
  progress: number 
}> = ({ 
  fileName, 
  progress 
}) => (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <Upload className="h-6 w-6 text-green-600 animate-pulse" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-green-900">
            Uploading {fileName}
          </h4>
          <span className="text-sm text-green-700">{progress}%</span>
        </div>
        <div className="w-full bg-green-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  </div>
)

// Download loading state
export const DownloadLoading: React.FC<{ 
  fileName: string 
}> = ({ 
  fileName 
}) => (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <Download className="h-6 w-6 text-orange-600 animate-bounce" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-orange-900">
          Preparing Download
        </h4>
        <p className="text-sm text-orange-700">
          Generating {fileName}...
        </p>
      </div>
      <div className="flex-shrink-0">
        <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
      </div>
    </div>
  </div>
)

// Database operation loading
export const DatabaseLoading: React.FC<{ 
  operation?: string 
}> = ({ 
  operation = "Updating data..." 
}) => (
  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0">
        <Database className="h-6 w-6 text-indigo-600 animate-pulse" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-indigo-900">
          Database Operation
        </h4>
        <p className="text-sm text-indigo-700">{operation}</p>
      </div>
    </div>
  </div>
)

// Button loading state
export const ButtonLoading: React.FC<{ 
  children: React.ReactNode
  isLoading: boolean
  className?: string 
}> = ({ 
  children, 
  isLoading, 
  className = "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
}) => (
  <button disabled={isLoading} className={className}>
    <div className="flex items-center space-x-2">
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      <span>{children}</span>
    </div>
  </button>
)

// Inline loading spinner
export const InlineLoading: React.FC<{ 
  size?: 'sm' | 'md' | 'lg'
  color?: string 
}> = ({ 
  size = 'md', 
  color = 'text-blue-600' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  return <Loader2 className={`${sizeClasses[size]} ${color} animate-spin`} />
}

// Retry loading state
export const RetryLoading: React.FC<{ 
  onRetry: () => void
  isRetrying: boolean
  message?: string 
}> = ({ 
  onRetry, 
  isRetrying, 
  message = "Failed to load. Please try again." 
}) => (
  <div className="text-center py-8">
    <p className="text-gray-600 mb-4">{message}</p>
    <button
      onClick={onRetry}
      disabled={isRetrying}
      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
    >
      {isRetrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
    </button>
  </div>
)

// Progress indicator
export const ProgressIndicator: React.FC<{ 
  steps: Array<{ label: string; completed: boolean }>
  currentStep: number 
}> = ({ 
  steps, 
  currentStep 
}) => (
  <div className="space-y-4">
    {steps.map((step, index) => (
      <div key={index} className="flex items-center space-x-3">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          step.completed 
            ? 'bg-green-100 text-green-800' 
            : index === currentStep 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-gray-100 text-gray-600'
        }`}>
          {step.completed ? '✓' : index + 1}
        </div>
        <span className={`text-sm ${
          step.completed 
            ? 'text-green-700' 
            : index === currentStep 
              ? 'text-blue-700 font-medium' 
              : 'text-gray-600'
        }`}>
          {step.label}
        </span>
        {index === currentStep && !step.completed && (
          <InlineLoading size="sm" color="text-blue-600" />
        )}
      </div>
    ))}
  </div>
)

export default {
  FullPageLoading,
  CardLoadingSkeleton,
  TableLoadingSkeleton,
  SearchLoading,
  DocumentProcessingLoading,
  AIProcessingLoading,
  UploadLoading,
  DownloadLoading,
  DatabaseLoading,
  ButtonLoading,
  InlineLoading,
  RetryLoading,
  ProgressIndicator
}