'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DocumentVersion {
  id: number
  document_path: string
  version_number: number
  content_hash: string
  content: string
  metadata: Record<string, any>
  created_by: string
  created_at: string
  valid_from: string
  valid_to: string | null
  is_current: boolean
}

interface VersionHistory {
  document_path: string
  versions: DocumentVersion[]
  total_versions: number
  created_span_days: number
  average_changes_per_version: number
}

interface VersionComparison {
  document_path: string
  version1: number
  version2: number
  changes: Array<{
    type: 'addition' | 'deletion' | 'modification'
    line_number: number
    content?: string
    old_content?: string
    new_content?: string
    change_type: string
  }>
  similarity_score: number
  change_summary: {
    lines_added: number
    lines_removed: number
    lines_modified: number
    similarity_percentage: number
    change_magnitude: string
  }
}

interface DocumentVersioningProps {
  documentPath: string
  apiUrl?: string
  className?: string
}

export function DocumentVersioning({ 
  documentPath, 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  className = '' 
}: DocumentVersioningProps) {
  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [compareVersion1, setCompareVersion1] = useState<number | null>(null)
  const [compareVersion2, setCompareVersion2] = useState<number | null>(null)
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'compare' | 'temporal'>('history')
  const [temporalDate, setTemporalDate] = useState('')

  const router = useRouter()

  // Load version history
  const loadVersionHistory = useCallback(async () => {
    if (!documentPath) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/versioning/documents/${encodeURIComponent(documentPath)}/versions`)
      if (!response.ok) throw new Error('Failed to load version history')
      
      const data: VersionHistory = await response.json()
      setVersionHistory(data)
      
      // Select current version by default
      const currentVersion = data.versions.find(v => v.is_current)
      if (currentVersion) {
        setSelectedVersion(currentVersion)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [documentPath, apiUrl])

  // Compare versions
  const compareVersions = useCallback(async () => {
    if (!compareVersion1 || !compareVersion2 || !documentPath) return

    setLoading(true)
    try {
      const response = await fetch(
        `${apiUrl}/versioning/documents/${encodeURIComponent(documentPath)}/versions/compare/${compareVersion1}/${compareVersion2}`
      )
      if (!response.ok) throw new Error('Failed to compare versions')
      
      const data: VersionComparison = await response.json()
      setComparison(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [documentPath, compareVersion1, compareVersion2, apiUrl])

  // Get document at specific time
  const getDocumentAtTime = useCallback(async () => {
    if (!temporalDate || !documentPath) return

    setLoading(true)
    try {
      const response = await fetch(
        `${apiUrl}/versioning/temporal/documents/${encodeURIComponent(documentPath)}?at_time=${encodeURIComponent(temporalDate)}`
      )
      if (!response.ok) throw new Error('Failed to get temporal version')
      
      const data = await response.json()
      // Create a temporary version object for display
      setSelectedVersion({
        ...data,
        id: 0,
        metadata: {},
        valid_to: null,
        is_current: false
      } as DocumentVersion)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [documentPath, temporalDate, apiUrl])

  useEffect(() => {
    loadVersionHistory()
  }, [loadVersionHistory])

  useEffect(() => {
    if (compareVersion1 && compareVersion2) {
      compareVersions()
    }
  }, [compareVersions])

  if (loading && !versionHistory) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <div className="text-red-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading versions</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!versionHistory) {
    return (
      <div className={`text-center p-8 text-gray-500 ${className}`}>
        No version history available
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Document Versions</h2>
            <p className="text-sm text-gray-600 mt-1">{documentPath}</p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{versionHistory.total_versions} versions</span>
            <span>•</span>
            <span>{versionHistory.created_span_days} days</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-8">
          {['history', 'compare', 'temporal'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Version List */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Version History</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {versionHistory.versions.map((version) => (
                <div
                  key={version.id}
                  onClick={() => setSelectedVersion(version)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedVersion?.id === version.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          version.is_current 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          v{version.version_number}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          Version {version.version_number}
                          {version.is_current && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          By {version.created_by} • {new Date(version.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {version.content_hash.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Version Content */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Content Preview</h3>
            {selectedVersion ? (
              <div className="border rounded-lg">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Version {selectedVersion.version_number}
                    </h4>
                    <div className="text-xs text-gray-500">
                      {new Date(selectedVersion.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-64 overflow-y-auto">
                    {selectedVersion.content.slice(0, 2000)}
                    {selectedVersion.content.length > 2000 && '...'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">Select a version to view content</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          {/* Version Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version 1
              </label>
              <select
                value={compareVersion1 || ''}
                onChange={(e) => setCompareVersion1(Number(e.target.value) || null)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select version...</option>
                {versionHistory.versions.map((v) => (
                  <option key={v.id} value={v.version_number}>
                    Version {v.version_number} ({v.created_by})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version 2
              </label>
              <select
                value={compareVersion2 || ''}
                onChange={(e) => setCompareVersion2(Number(e.target.value) || null)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select version...</option>
                {versionHistory.versions.map((v) => (
                  <option key={v.id} value={v.version_number}>
                    Version {v.version_number} ({v.created_by})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Results */}
          {comparison && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Change Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      +{comparison.change_summary.lines_added}
                    </div>
                    <div className="text-sm text-gray-500">Added</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      -{comparison.change_summary.lines_removed}
                    </div>
                    <div className="text-sm text-gray-500">Removed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      ~{comparison.change_summary.lines_modified}
                    </div>
                    <div className="text-sm text-gray-500">Modified</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {comparison.change_summary.similarity_percentage}%
                    </div>
                    <div className="text-sm text-gray-500">Similar</div>
                  </div>
                </div>
              </div>

              {/* Change Details */}
              <div className="border rounded-lg">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="font-medium text-gray-900">
                    Changes ({comparison.changes.length})
                  </h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {comparison.changes.map((change, index) => (
                    <div
                      key={index}
                      className={`px-4 py-2 border-b last:border-b-0 ${
                        change.type === 'addition' ? 'bg-green-50 border-green-200' :
                        change.type === 'deletion' ? 'bg-red-50 border-red-200' :
                        'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          change.type === 'addition' ? 'bg-green-100 text-green-800' :
                          change.type === 'deletion' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {change.type === 'addition' ? '+' : change.type === 'deletion' ? '-' : '~'}
                          {change.line_number}
                        </span>
                        <div className="flex-1 text-sm">
                          {change.type === 'modification' ? (
                            <div className="space-y-1">
                              <div className="text-red-600">- {change.old_content}</div>
                              <div className="text-green-600">+ {change.new_content}</div>
                            </div>
                          ) : (
                            <div className={
                              change.type === 'addition' ? 'text-green-600' : 'text-red-600'
                            }>
                              {change.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temporal Tab */}
      {activeTab === 'temporal' && (
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Time Travel Query</h3>
            <p className="text-sm text-blue-700">
              View the document content as it existed at any point in time.
            </p>
          </div>

          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date and Time
              </label>
              <input
                type="datetime-local"
                value={temporalDate}
                onChange={(e) => setTemporalDate(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={getDocumentAtTime}
              disabled={!temporalDate || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Query'}
            </button>
          </div>

          {selectedVersion && temporalDate && (
            <div className="border rounded-lg">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h4 className="text-sm font-medium">
                  Content at {new Date(temporalDate).toLocaleString()}
                </h4>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-64 overflow-y-auto">
                  {selectedVersion.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}