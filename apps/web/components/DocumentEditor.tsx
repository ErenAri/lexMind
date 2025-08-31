'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  Save, 
  Undo, 
  Redo,
  FileText,
  Tag,
  Calendar,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createApiClient } from '@/lib/api'

interface DocumentEditorProps {
  document: {
    id: string
    path: string
    display_name: string
    content: string
    description?: string
    tags?: string[]
    type?: 'doc' | 'reg'
    version?: number
  }
  onClose: () => void
  onSave?: (updatedDocument: any) => void
}

export default function DocumentEditor({ document, onClose, onSave }: DocumentEditorProps) {
  const { token } = useAuth()
  const api = React.useMemo(() => createApiClient(token), [token])
  
  const [content, setContent] = useState(document.content)
  const [displayName, setDisplayName] = useState(document.display_name)
  const [description, setDescription] = useState(document.description || '')
  const [tags, setTags] = useState<string[]>(document.tags || [])
  const [newTag, setNewTag] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  const [history, setHistory] = useState<string[]>([document.content])
  const [historyIndex, setHistoryIndex] = useState(0)

  useEffect(() => {
    // Load full document content if we only have preview
    if (!document.content || document.content.length < 500) {
      loadFullDocument()
    }
  }, [])

  const loadFullDocument = async () => {
    setIsLoading(true)
    try {
      const response = await api.request(`/documents/${encodeURIComponent(document.path)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.content && data.content !== content) {
          setContent(data.content)
          setHistory([data.content])
          setHistoryIndex(0)
        }
      }
    } catch (e) {
      console.error('Failed to load full document content:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Track changes
    const hasChanges = 
      content !== document.content ||
      displayName !== document.display_name ||
      description !== (document.description || '') ||
      JSON.stringify(tags) !== JSON.stringify(document.tags || [])
    
    setHasUnsavedChanges(hasChanges)
  }, [content, displayName, description, tags, document])

  useEffect(() => {
    // Auto-save draft every 30 seconds
    if (hasUnsavedChanges) {
      const timer = setTimeout(() => {
        saveDraft()
      }, 30000)
      
      return () => clearTimeout(timer)
    }
  }, [hasUnsavedChanges, content, displayName, description, tags])

  const updateHistory = (newContent: string) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newContent)
    
    // Keep only last 50 changes
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(prev => prev + 1)
    }
    
    setHistory(newHistory)
  }

  const handleContentChange = (newContent: string) => {
    if (newContent !== content) {
      updateHistory(newContent)
    }
    setContent(newContent)
  }

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setContent(history[newIndex])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setContent(history[newIndex])
    }
  }

  const addTag = () => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags(prev => [...prev, trimmedTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  const saveDraft = async () => {
    try {
      await api.request(`/documents/${encodeURIComponent(document.path)}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          display_name: displayName,
          description,
          tags
        })
      })
    } catch (e) {
      console.warn('Failed to save draft:', e)
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    
    setIsSaving(true)
    setSaveStatus('saving')
    setError(null)
    
    try {
      // Update document metadata
      const metadataResponse = await api.request(`/documents/${encodeURIComponent(document.path)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          description: description || null,
          tags
        })
      })
      
      if (!metadataResponse.ok) {
        throw new Error(`Failed to update metadata: ${metadataResponse.status}`)
      }

      // If content changed, create a new version
      if (content !== document.content) {
        const contentResponse = await api.request(`/documents/${document.id}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            change_summary: 'Document updated via editor',
            is_major: false
          })
        })
        
        if (!contentResponse.ok) {
          throw new Error(`Failed to save content: ${contentResponse.status}`)
        }
      }
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      
      const updatedDocument = {
        ...document,
        content,
        display_name: displayName,
        description,
        tags,
        version: (document.version || 1) + (content !== document.content ? 1 : 0)
      }
      
      if (onSave) {
        onSave(updatedDocument)
      }
      
    } catch (e) {
      console.error('Error saving document:', e)
      setError(e instanceof Error ? e.message : 'Failed to save document')
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  const getWordCount = () => {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  const getCharCount = () => {
    return content.length
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="h-full max-w-6xl mx-auto bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Document</h2>
              <p className="text-sm text-gray-600">{document.path}</p>
            </div>
            {isLoading && (
              <div className="flex items-center space-x-1 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Loading content...</span>
              </div>
            )}
            {!isLoading && hasUnsavedChanges && (
              <div className="flex items-center space-x-1 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Unsaved changes</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Undo/Redo */}
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo"
              >
                <Undo className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo"
              >
                <Redo className="h-4 w-4" />
              </button>
            </div>
            
            {/* Save Status */}
            <div className="flex items-center space-x-2">
              {saveStatus === 'saving' && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Saving...</span>
                </div>
              )}
              
              {saveStatus === 'saved' && (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Saved</span>
                </div>
              )}
              
              {saveStatus === 'error' && error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Error: {error}</span>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
            
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Editor */}
          <div className="flex-1 flex flex-col">
            {/* Document Metadata */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter document title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description..."
                  />
                </div>
              </div>
              
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="inline h-4 w-4 mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Add a tag..."
                  />
                  <button
                    onClick={addTag}
                    disabled={!newTag.trim()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            
            {/* Text Editor */}
            <div className="flex-1 p-4">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm leading-relaxed resize-none"
                placeholder="Enter document content..."
                spellCheck={false}
              />
            </div>
          </div>
          
          {/* Sidebar with stats */}
          <div className="w-64 border-l border-gray-200 bg-gray-50 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Document Stats</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Words:</span>
                  <span>{getWordCount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Characters:</span>
                  <span>{getCharCount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="capitalize">{document.type || 'Document'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span>{document.version || 1}</span>
                </div>
              </div>
            </div>
            
            {/* Recent Changes */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                History
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Changes: {history.length - 1}</div>
                <div>Current: {historyIndex + 1}/{history.length}</div>
              </div>
            </div>
            
            {/* Auto-save info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <CheckCircle className="inline h-3 w-3 mr-1" />
                Auto-saves draft every 30 seconds
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}