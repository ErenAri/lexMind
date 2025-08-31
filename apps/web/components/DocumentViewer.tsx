'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  Download, 
  Edit, 
  Star, 
  Clock, 
  Eye, 
  Tag,
  FileText,
  BookOpen,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createApiClient } from '@/lib/api'

interface DocumentViewerProps {
  documentId: string
  documentPath: string
  displayName: string
  onClose: () => void
  onEdit?: (document: any) => void
}

interface DocumentContent {
  path: string
  content: string
  metadata?: {
    display_name?: string
    description?: string
    tags?: string[]
    created_at?: string
    last_modified?: string
    file_size?: number
    type?: 'doc' | 'reg'
    version?: number
  }
}

export default function DocumentViewer({ 
  documentId, 
  documentPath, 
  displayName, 
  onClose, 
  onEdit 
}: DocumentViewerProps) {
  const { token } = useAuth()
  const api = React.useMemo(() => createApiClient(token), [token])
  
  const [document, setDocument] = useState<DocumentContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<number[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)

  useEffect(() => {
    loadDocument()
  }, [documentPath, api])

  const loadDocument = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Use the document path to fetch content
      const response = await api.request(`/documents/${encodeURIComponent(documentPath)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`)
      }
      
      const data = await response.json()
      setDocument(data)
      
      // Track document access
      try {
        await api.request(`/documents/${encodeURIComponent(documentId)}/access`, {
          method: 'POST'
        })
      } catch (e) {
        console.warn('Failed to track document access:', e)
      }
      
    } catch (e) {
      console.error('Error loading document:', e)
      setError(e instanceof Error ? e.message : 'Failed to load document')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !document?.content) {
      setSearchResults([])
      setCurrentSearchIndex(-1)
      return
    }

    const content = document.content.toLowerCase()
    const searchTerm = query.toLowerCase()
    const indices: number[] = []
    
    let index = content.indexOf(searchTerm)
    while (index !== -1) {
      indices.push(index)
      index = content.indexOf(searchTerm, index + 1)
    }
    
    setSearchResults(indices)
    setCurrentSearchIndex(indices.length > 0 ? 0 : -1)
  }

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return
    
    if (direction === 'next') {
      setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length)
    } else {
      setCurrentSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length)
    }
  }

  const highlightSearchResults = (text: string) => {
    if (!searchQuery.trim() || searchResults.length === 0) {
      return text
    }

    let result = text
    const searchTerm = searchQuery
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    
    result = result.replace(regex, (match, p1, offset) => {
      const isCurrentResult = searchResults.includes(offset)
      const className = isCurrentResult && offset === searchResults[currentSearchIndex] 
        ? 'bg-yellow-300 text-black font-semibold' 
        : 'bg-yellow-100 text-black'
      return `<mark class="${className}">${match}</mark>`
    })
    
    return result
  }

  const downloadDocument = async () => {
    if (!document) return
    
    try {
      const blob = new Blob([document.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${displayName}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download document:', e)
    }
  }

  const handleEdit = () => {
    if (onEdit && document) {
      onEdit({
        id: documentId,
        path: documentPath,
        display_name: displayName,
        content: document.content,
        ...document.metadata
      })
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Loading Document</h3>
              <p className="text-sm text-gray-600">Please wait...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Error Loading Document</h3>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${isFullscreen ? '' : 'p-4'}`}>
      <div className={`bg-white ${isFullscreen ? 'h-full' : 'h-full max-w-6xl mx-auto rounded-lg'} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h2>
              <p className="text-sm text-gray-600">{documentPath}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search in document..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchResults.length > 0 && (
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <button
                    onClick={() => navigateSearch('prev')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>{currentSearchIndex + 1} of {searchResults.length}</span>
                  <button
                    onClick={() => navigateSearch('next')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Font Size Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setFontSize(Math.max(10, fontSize - 2))}
                className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                A-
              </button>
              <span className="text-sm text-gray-600">{fontSize}px</span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                A+
              </button>
            </div>
            
            {/* Action Buttons */}
            <button
              onClick={downloadDocument}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            
            {onEdit && (
              <button
                onClick={handleEdit}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                title="Edit Document"
              >
                <Edit className="h-5 w-5" />
              </button>
            )}
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document Metadata */}
        {document?.metadata && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              {document.metadata.type && (
                <span className="flex items-center space-x-1">
                  <BookOpen className="h-4 w-4 text-gray-500" />
                  <span className="capitalize text-gray-700">{document.metadata.type}</span>
                </span>
              )}
              
              {document.metadata.version && (
                <span className="text-gray-700">Version {document.metadata.version}</span>
              )}
              
              {document.metadata.last_modified && (
                <span className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {new Date(document.metadata.last_modified).toLocaleDateString()}
                  </span>
                </span>
              )}
              
              {document.metadata.file_size && (
                <span className="text-gray-700">
                  {(document.metadata.file_size / 1024).toFixed(1)} KB
                </span>
              )}
              
              {document.metadata.tags && document.metadata.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <div className="flex flex-wrap gap-1">
                    {document.metadata.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                    {document.metadata.tags.length > 3 && (
                      <span className="text-gray-500 text-xs">+{document.metadata.tags.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Document Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            {document?.content ? (
              <div 
                className="prose max-w-none whitespace-pre-wrap font-mono leading-relaxed"
                style={{ fontSize: `${fontSize}px` }}
                dangerouslySetInnerHTML={{ 
                  __html: highlightSearchResults(document.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                }}
              />
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No content available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}