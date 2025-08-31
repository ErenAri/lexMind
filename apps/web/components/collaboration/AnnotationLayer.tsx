'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useCollaboration, Annotation } from './CollaborationProvider'

interface AnnotationLayerProps {
  children: React.ReactNode
  documentContent: string
  className?: string
}

interface SelectionData {
  start: number
  end: number
  text: string
  rect: DOMRect
}

export function AnnotationLayer({ children, documentContent, className = '' }: AnnotationLayerProps) {
  const {
    annotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    sendCursorPosition,
    sendSelection,
    activeUsers,
    userSelections
  } = useCollaboration()

  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [showAnnotationMenu, setShowAnnotationMenu] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      const selectionData: SelectionData = {
        start: range.startOffset,
        end: range.endOffset,
        text: sel.toString(),
        rect
      }
      
      setSelection(selectionData)
      setShowAnnotationMenu(true)
      
      // Send selection to other users
      sendSelection(selectionData.start, selectionData.end, selectionData.text)
    } else {
      setSelection(null)
      setShowAnnotationMenu(false)
    }
  }, [sendSelection])

  // Handle cursor movement
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const newPosition = { x: e.clientX, y: e.clientY }
    setCursorPosition(newPosition)
    sendCursorPosition(newPosition.x, newPosition.y)
  }, [sendCursorPosition])

  // Create annotation
  const handleCreateAnnotation = useCallback((type: Annotation['annotation_type'], data: any = {}) => {
    if (!selection) return

    createAnnotation({
      annotation_type: type,
      start_offset: selection.start,
      end_offset: selection.end,
      text_content: selection.text,
      annotation_data: {
        color: getAnnotationColor(type),
        ...data
      }
    })

    setSelection(null)
    setShowAnnotationMenu(false)
    
    // Clear selection
    window.getSelection()?.removeAllRanges()
  }, [selection, createAnnotation])

  // Render text with annotations
  const renderAnnotatedText = useCallback(() => {
    if (!documentContent) return null

    let annotatedContent = documentContent
    const sortedAnnotations = [...annotations].sort((a, b) => a.start_offset - b.start_offset)
    
    // Apply annotations in reverse order to maintain offset positions
    for (let i = sortedAnnotations.length - 1; i >= 0; i--) {
      const ann = sortedAnnotations[i]
      const before = annotatedContent.slice(0, ann.start_offset)
      const annotated = annotatedContent.slice(ann.start_offset, ann.end_offset)
      const after = annotatedContent.slice(ann.end_offset)
      
      const className = getAnnotationClassName(ann.annotation_type)
      const style = { backgroundColor: ann.annotation_data.color || '#ffeb3b' }
      
      annotatedContent = 
        before + 
        `<span class="${className}" data-annotation-id="${ann.id}" style="background-color: ${style.backgroundColor}">${annotated}</span>` + 
        after
    }

    return <div dangerouslySetInnerHTML={{ __html: annotatedContent }} />
  }, [documentContent, annotations])

  // Render other users' selections
  const renderUserSelections = useCallback(() => {
    return Array.from(userSelections.entries()).map(([userId, sel]) => (
      <div
        key={userId}
        className="absolute pointer-events-none border-2 border-dashed opacity-60"
        style={{
          // This would need proper positioning based on text offsets
          // For demo purposes, showing concept
          borderColor: '#4ECDC4',
          backgroundColor: 'rgba(78, 205, 196, 0.1)'
        }}
      >
        <div className="absolute -top-6 left-0 text-xs bg-gray-800 text-white px-2 py-1 rounded">
          {userId.split('@')[0]} selected
        </div>
      </div>
    ))
  }, [userSelections])

  // Render other users' cursors
  const renderUserCursors = useCallback(() => {
    return Array.from(activeUsers.entries()).map(([userId, cursor]) => (
      <div
        key={userId}
        className="absolute pointer-events-none z-50"
        style={{
          left: cursor.x,
          top: cursor.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: cursor.color }}
        />
        <div 
          className="absolute top-4 left-0 text-xs px-2 py-1 rounded whitespace-nowrap"
          style={{ 
            backgroundColor: cursor.color, 
            color: 'white'
          }}
        >
          {userId.split('@')[0]}
        </div>
      </div>
    ))
  }, [activeUsers])

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      {/* Main content */}
      <div className="relative">
        {renderAnnotatedText()}
        {children}
      </div>

      {/* User selections */}
      {renderUserSelections()}

      {/* User cursors */}
      {renderUserCursors()}

      {/* Annotation menu */}
      {showAnnotationMenu && selection && (
        <div 
          className="absolute z-40 bg-white border border-gray-300 rounded-lg shadow-lg p-2"
          style={{
            left: selection.rect.left + selection.rect.width / 2,
            top: selection.rect.top - 60,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex space-x-2">
            <button
              onClick={() => handleCreateAnnotation('highlight', { color: '#ffeb3b' })}
              className="px-3 py-1 text-sm bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300"
            >
              Highlight
            </button>
            <button
              onClick={() => handleCreateAnnotation('risk_flag', { 
                risk_level: 'high', 
                color: '#f44336' 
              })}
              className="px-3 py-1 text-sm bg-red-200 text-red-800 rounded hover:bg-red-300"
            >
              Risk Flag
            </button>
            <button
              onClick={() => {
                const comment = window.prompt('Add a comment:')
                if (comment) {
                  handleCreateAnnotation('comment', { 
                    comment, 
                    color: '#2196f3' 
                  })
                }
              }}
              className="px-3 py-1 text-sm bg-blue-200 text-blue-800 rounded hover:bg-blue-300"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Annotations sidebar */}
      <div className="fixed right-4 top-20 w-80 max-h-96 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-4">Annotations</h3>
          
          {annotations.length === 0 ? (
            <p className="text-gray-500 text-sm">No annotations yet. Select text to add annotations.</p>
          ) : (
            <div className="space-y-3">
              {annotations.map((annotation) => (
                <div key={annotation.id} className="border-l-4 pl-3 py-2" style={{ borderColor: annotation.annotation_data.color || '#gray' }}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-medium capitalize">
                        {annotation.annotation_type.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        "{annotation.text_content}"
                      </div>
                      {annotation.annotation_data.comment && (
                        <div className="text-sm text-gray-800 mt-2">
                          {annotation.annotation_data.comment}
                        </div>
                      )}
                      {annotation.annotation_data.risk_level && (
                        <div className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                          annotation.annotation_data.risk_level === 'high' ? 'bg-red-100 text-red-800' :
                          annotation.annotation_data.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {annotation.annotation_data.risk_level.toUpperCase()} RISK
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-2">
                        {annotation.user_id} • {new Date(annotation.created_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAnnotation(annotation.id)}
                      className="text-gray-400 hover:text-red-600 text-sm ml-2"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getAnnotationColor(type: Annotation['annotation_type']): string {
  switch (type) {
    case 'highlight': return '#ffeb3b'
    case 'risk_flag': return '#f44336'
    case 'comment': return '#2196f3'
    case 'compliance_note': return '#4caf50'
    default: return '#9e9e9e'
  }
}

function getAnnotationClassName(type: Annotation['annotation_type']): string {
  return `annotation annotation-${type}`
}