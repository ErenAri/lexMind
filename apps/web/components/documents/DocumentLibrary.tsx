'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  FileText, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Clock, 
  Star, 
  Eye, 
  Download,
  Tag,
  Calendar,
  Folder,
  ChevronDown,
  Archive,
  BookOpen,
  History,
  Edit,
  Trash2
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createApiClient } from '@/lib/api'
import DocumentViewer from '../DocumentViewer'
import DocumentEditor from '../DocumentEditor'

type DocumentItem = {
  id: string
  path: string
  display_name: string
  description: string | null
  content_preview: string | null
  type: 'doc' | 'reg'
  category: string
  tags: string[]
  first_seen: string
  last_seen: string
  last_accessed: string
  access_count: number
  chunks: number
  file_size: number
  is_favorite: boolean
  version: number
  status: 'active' | 'archived' | 'draft'
}

interface DocumentLibraryProps {
  mode?: 'full' | 'recent' | 'favorites'
  limit?: number
  onDocumentSelect?: (doc: DocumentItem) => void
}

export default function DocumentLibrary({ 
  mode = 'full', 
  limit,
  onDocumentSelect 
}: DocumentLibraryProps) {
  const { token } = useAuth()
  const api = useMemo(() => createApiClient(token), [token])
  
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'accessed' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [viewerDocument, setViewerDocument] = useState<DocumentItem | null>(null)
  const [editorDocument, setEditorDocument] = useState<DocumentItem | null>(null)

  // Load documents based on mode
  useEffect(() => {
    let cancelled = false
    
    async function loadDocuments() {
      setIsLoading(true)
      try {
        let endpoint = '/documents/library'
        const params = new URLSearchParams()
        
        if (mode === 'recent') {
          endpoint = '/documents/recent'
          if (limit) params.set('limit', limit.toString())
        } else if (mode === 'favorites') {
          endpoint = '/documents/favorites'
          if (limit) params.set('limit', limit.toString())
        } else {
          params.set('include_preview', 'true')
          params.set('include_stats', 'true')
        }

        const url = params.toString() ? `${endpoint}?${params}` : endpoint
        let res = await api.request(url)

        // Helper to map legacy API (/documents) to UI shape
        const mapLegacyDocuments = (legacyDocs: any[]): DocumentItem[] => {
          return (legacyDocs || []).map((d: any): DocumentItem => {
            const path: string = d.path || d.title || d.display_name || 'unknown'
            const displayName: string = d.display_name || (typeof path === 'string' ? (path.includes('/') ? path.split('/').pop() : path) : 'Document')
            return {
              id: path,
              path,
              display_name: displayName,
              description: d.description ?? null,
              content_preview: null,
              type: (d.type === 'reg' ? 'reg' : 'doc'),
              category: 'general',
              tags: [],
              first_seen: d.first_seen || new Date().toISOString(),
              last_seen: d.last_seen || d.first_seen || new Date().toISOString(),
              last_accessed: d.last_seen || d.first_seen || new Date().toISOString(),
              access_count: 0,
              chunks: typeof d.chunks === 'number' ? d.chunks : 1,
              file_size: 0,
              is_favorite: false,
              version: 1,
              status: 'active'
            }
          })
        }

        let docs: DocumentItem[] = []

        if (res.ok) {
          const json = await res.json()
          const raw = (json && Array.isArray(json.documents)) ? json.documents : []
          // If the objects already look like our UI shape (have id/display_name), use as-is
          if (raw.length > 0 && (raw[0].id || raw[0].display_name)) {
            docs = raw as DocumentItem[]
          } else {
            // Map any unknown/lean shape into our UI shape
            docs = mapLegacyDocuments(raw as any[])
          }
        } else {
          // Fallback to legacy endpoint supported by SQLite API
          const legacyRes = await api.request('/documents')
          if (!legacyRes.ok) throw new Error(`Failed: ${legacyRes.status}`)
          const legacyJson = await legacyRes.json()
          const legacyArray = Array.isArray(legacyJson?.documents) ? legacyJson.documents : (Array.isArray(legacyJson) ? legacyJson : [])
          docs = mapLegacyDocuments(legacyArray as any[])
        }

        if (!cancelled) setDocuments(docs)
      } catch (e) {
        console.error('Failed to load documents', e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadDocuments()
    return () => { cancelled = true }
  }, [api, mode, limit])

  // Filter and sort documents
  const processedDocuments = useMemo(() => {
    let filtered = documents

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(doc => 
        doc.display_name.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q) ||
        doc.content_preview?.toLowerCase().includes(q) ||
        doc.tags.some(tag => tag.toLowerCase().includes(q)) ||
        doc.category.toLowerCase().includes(q)
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory)
    }

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(doc => doc.type === selectedType)
    }

    // Sort documents
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortBy) {
        case 'name':
          aVal = a.display_name.toLowerCase()
          bVal = b.display_name.toLowerCase()
          break
        case 'date':
          aVal = new Date(a.last_seen)
          bVal = new Date(b.last_seen)
          break
        case 'accessed':
          aVal = new Date(a.last_accessed)
          bVal = new Date(b.last_accessed)
          break
        case 'size':
          aVal = a.file_size
          bVal = b.file_size
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [documents, searchQuery, selectedCategory, selectedType, sortBy, sortOrder])

  // Get unique categories and types for filters
  const categories = useMemo(() => 
    [...new Set(documents.map(doc => doc.category))].filter(Boolean),
    [documents]
  )

  const toggleFavorite = async (docId: string) => {
    try {
      const doc = documents.find(d => d.id === docId)
      if (!doc) return

      await api.request(`/documents/${docId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: !doc.is_favorite })
      })

      setDocuments(prev => prev.map(d => 
        d.id === docId ? { ...d, is_favorite: !d.is_favorite } : d
      ))
    } catch (e) {
      console.error('Failed to toggle favorite', e)
    }
  }

  const viewDocument = async (doc: DocumentItem) => {
    try {
      // Track access
      await api.request(`/documents/${doc.id}/access`, {
        method: 'POST'
      })

      // Update local state
      setDocuments(prev => prev.map(d => 
        d.id === doc.id 
          ? { ...d, access_count: d.access_count + 1, last_accessed: new Date().toISOString() }
          : d
      ))

      // Open document viewer
      setViewerDocument(doc)
      
      if (onDocumentSelect) {
        onDocumentSelect(doc)
      }
    } catch (e) {
      console.error('Failed to track document access', e)
    }
  }
  
  const editDocument = (doc: DocumentItem) => {
    setEditorDocument(doc)
  }
  
  const handleDocumentSave = (updatedDocument: any) => {
    // Update document in local state
    setDocuments(prev => prev.map(d => 
      d.id === updatedDocument.id ? { ...d, ...updatedDocument } : d
    ))
    setEditorDocument(null)
  }
  
  const handleViewerEdit = (doc: any) => {
    setViewerDocument(null)
    setEditorDocument(doc)
  }
  
  const deleteDocument = async (doc: DocumentItem) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.display_name}"?`)) {
      return
    }
    
    try {
      const response = await api.request(`/documents/${encodeURIComponent(doc.path)}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id))
      } else {
        throw new Error(`Failed to delete document: ${response.status}`)
      }
    } catch (e) {
      console.error('Failed to delete document:', e)
      alert('Failed to delete document. Please try again.')
    }
  }
  
  const downloadDocument = async (doc: DocumentItem) => {
    try {
      // First get the document content
      const response = await api.request(`/documents/${encodeURIComponent(doc.path)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`)
      }
      
      const data = await response.json()
      const content = data.content || ''
      
      // Create download
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${doc.display_name}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download document:', e)
      alert('Failed to download document. Please try again.')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getTypeIcon = (type: string) => {
    return type === 'reg' ? '📋' : '📄'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      {mode === 'full' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search documents, content, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              <div className="flex rounded-lg border border-gray-300">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="doc">Documents</option>
                  <option value="reg">Regulations</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">Last Modified</option>
                  <option value="name">Name</option>
                  <option value="accessed">Last Accessed</option>
                  <option value="size">File Size</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents List */}
      {processedDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No documents found' : 'No documents available'}
          </h3>
          <p className="text-gray-600">
            {searchQuery ? 'Try adjusting your search criteria' : 'Upload documents to get started'}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'space-y-4'
        }>
          {processedDocuments.map((doc) => (
            viewMode === 'grid' ? (
              <div key={doc.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getTypeIcon(doc.type)}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 line-clamp-2 text-sm">
                        {doc.display_name}
                      </h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)} mt-1`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFavorite(doc.id)}
                    className={`p-1 rounded ${doc.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                  >
                    <Star className={`h-4 w-4 ${doc.is_favorite ? 'fill-current' : ''}`} />
                  </button>
                </div>
                
                {doc.content_preview && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {doc.content_preview}
                  </p>
                )}
                
                <div className="space-y-2 text-xs text-gray-500 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Size: {formatFileSize(doc.file_size)}</span>
                    <span>v{doc.version}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(doc.last_seen)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Eye className="h-3 w-3" />
                    <span>{doc.access_count} views</span>
                  </div>
                </div>
                
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {doc.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{doc.tags.length - 3} more</span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => viewDocument(doc)}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Open</span>
                  </button>
                  <button 
                    onClick={() => downloadDocument(doc)}
                    className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                    title="Download Document"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => editDocument(doc)}
                    className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                    title="Edit Document"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => deleteDocument(doc)}
                    className="p-2 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50"
                    title="Delete Document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div key={doc.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <span className="text-2xl">{getTypeIcon(doc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {doc.display_name}
                        </h3>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                        {doc.is_favorite && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Folder className="h-3 w-3" />
                          <span>{doc.category}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(doc.last_seen)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Eye className="h-3 w-3" />
                          <span>{doc.access_count} views</span>
                        </span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                      {doc.content_preview && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {doc.content_preview}
                        </p>
                      )}
                      {doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.slice(0, 5).map(tag => (
                            <span key={tag} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 5 && (
                            <span className="text-xs text-gray-500">+{doc.tags.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => viewDocument(doc)}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Open</span>
                    </button>
                    <button
                      onClick={() => toggleFavorite(doc.id)}
                      className={`p-2 rounded-lg ${doc.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                    >
                      <Star className={`h-4 w-4 ${doc.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={() => downloadDocument(doc)}
                      className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                      title="Download Document"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => editDocument(doc)}
                      className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                      title="Edit Document"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => deleteDocument(doc)}
                      className="p-2 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50"
                      title="Delete Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-gray-600 text-center">
        Showing {processedDocuments.length} of {documents.length} documents
      </div>
      
      {/* Document Viewer Modal */}
      {viewerDocument && (
        <DocumentViewer
          documentId={viewerDocument.id}
          documentPath={viewerDocument.path}
          displayName={viewerDocument.display_name}
          onClose={() => setViewerDocument(null)}
          onEdit={handleViewerEdit}
        />
      )}
      
      {/* Document Editor Modal */}
      {editorDocument && (
        <DocumentEditor
          document={{
            id: editorDocument.id,
            path: editorDocument.path,
            display_name: editorDocument.display_name,
            content: '', // Will be loaded by the editor component
            description: editorDocument.description,
            tags: editorDocument.tags,
            type: editorDocument.type,
            version: editorDocument.version
          }}
          onClose={() => setEditorDocument(null)}
          onSave={handleDocumentSave}
        />
      )}
    </div>
  )
}