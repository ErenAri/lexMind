'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

export interface CollaborationUser {
  user_id: string
  role: string
  location?: string
  color?: string
}

export interface Annotation {
  id: string
  user_id: string
  annotation_type: 'highlight' | 'comment' | 'risk_flag' | 'compliance_note'
  start_offset: number
  end_offset: number
  text_content: string
  annotation_data: {
    color?: string
    risk_level?: 'high' | 'medium' | 'low'
    comment?: string
    priority?: 'high' | 'medium' | 'low'
  }
  created_at: string
  is_resolved: boolean
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'annotation' | 'cursor_move' | 'selection_change'
  user_id: string
  timestamp: string
  data?: any
}

interface CollaborationContextType {
  sessionId: string | null
  isConnected: boolean
  participants: CollaborationUser[]
  annotations: Annotation[]
  events: CollaborationEvent[]
  
  // Actions
  createAnnotation: (annotation: Omit<Annotation, 'id' | 'user_id' | 'created_at' | 'is_resolved'>) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  sendCursorPosition: (x: number, y: number) => void
  sendSelection: (start: number, end: number, text: string) => void
  
  // UI State
  activeUsers: Map<string, { x: number; y: number; color: string }>
  userSelections: Map<string, { start: number; end: number; text: string }>
}

const CollaborationContext = createContext<CollaborationContextType | null>(null)

interface CollaborationProviderProps {
  children: React.ReactNode
  documentPath: string
  userId: string
  apiUrl?: string
}

export function CollaborationProvider({ 
  children, 
  documentPath, 
  userId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}: CollaborationProviderProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<CollaborationUser[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [events, setEvents] = useState<CollaborationEvent[]>([])
  const [activeUsers, setActiveUsers] = useState<Map<string, { x: number; y: number; color: string }>>(new Map())
  const [userSelections, setUserSelections] = useState<Map<string, { start: number; end: number; text: string }>>(new Map())

  // Create collaboration session
  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/serverless/collaboration/session?document_path=${encodeURIComponent(documentPath)}&user_id=${encodeURIComponent(userId)}`, {
          method: 'POST',
        })
        
        if (response.ok) {
          const data = await response.json()
          setSessionId(data.session_id)
        }
      } catch (error) {
        console.error('Failed to create collaboration session:', error)
      }
    }

    if (documentPath && userId) {
      createSession()
    }
  }, [documentPath, userId, apiUrl])

  // WebSocket connection
  const websocketUrl = sessionId 
    ? `${apiUrl.replace('http', 'ws')}/serverless/collaboration/ws/${sessionId}?user_id=${encodeURIComponent(userId)}`
    : null

  const { isConnected, sendMessage } = useWebSocket({
    url: websocketUrl,
    onMessage: useCallback((message: CollaborationEvent) => {
      setEvents(prev => [...prev.slice(-99), message]) // Keep last 100 events
      
      switch (message.type) {
        case 'user_joined':
          setParticipants(prev => {
            const existing = prev.find(p => p.user_id === message.user_id)
            if (!existing) {
              return [...prev, {
                user_id: message.user_id,
                role: 'participant',
                color: generateUserColor(message.user_id)
              }]
            }
            return prev
          })
          break
          
        case 'user_left':
          setParticipants(prev => prev.filter(p => p.user_id !== message.user_id))
          setActiveUsers(prev => {
            const newMap = new Map(prev)
            newMap.delete(message.user_id)
            return newMap
          })
          setUserSelections(prev => {
            const newMap = new Map(prev)
            newMap.delete(message.user_id)
            return newMap
          })
          break
          
        case 'annotation':
          if (message.data) {
            setAnnotations(prev => {
              // Update existing or add new
              const existingIndex = prev.findIndex(a => a.id === message.data.id)
              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = message.data
                return updated
              } else {
                return [...prev, message.data]
              }
            })
          }
          break
          
        case 'cursor_move':
          if (message.data && message.user_id !== userId) {
            setActiveUsers(prev => {
              const newMap = new Map(prev)
              newMap.set(message.user_id, {
                x: message.data.x,
                y: message.data.y,
                color: generateUserColor(message.user_id)
              })
              return newMap
            })
          }
          break
          
        case 'selection_change':
          if (message.data && message.user_id !== userId) {
            setUserSelections(prev => {
              const newMap = new Map(prev)
              newMap.set(message.user_id, {
                start: message.data.start,
                end: message.data.end,
                text: message.data.text
              })
              return newMap
            })
          }
          break
      }
    }, [userId])
  })

  // Actions
  const createAnnotation = useCallback((annotation: Omit<Annotation, 'id' | 'user_id' | 'created_at' | 'is_resolved'>) => {
    if (!isConnected || !sessionId) return

    const fullAnnotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      is_resolved: false
    }

    sendMessage({
      type: 'annotation',
      document_path: documentPath,
      annotation_type: annotation.annotation_type,
      start_offset: annotation.start_offset,
      end_offset: annotation.end_offset,
      text_content: annotation.text_content,
      annotation_data: annotation.annotation_data
    })

    // Optimistic update
    setAnnotations(prev => [...prev, fullAnnotation])
  }, [isConnected, sessionId, userId, documentPath, sendMessage])

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    if (!isConnected || !sessionId) return

    setAnnotations(prev => prev.map(ann => 
      ann.id === id ? { ...ann, ...updates } : ann
    ))

    sendMessage({
      type: 'annotation',
      annotation_id: id,
      updates: updates
    })
  }, [isConnected, sessionId, sendMessage])

  const deleteAnnotation = useCallback((id: string) => {
    if (!isConnected || !sessionId) return

    setAnnotations(prev => prev.filter(ann => ann.id !== id))

    sendMessage({
      type: 'annotation',
      annotation_id: id,
      action: 'delete'
    })
  }, [isConnected, sessionId, sendMessage])

  const sendCursorPosition = useCallback((x: number, y: number) => {
    if (!isConnected || !sessionId) return

    sendMessage({
      type: 'cursor_move',
      x,
      y
    })
  }, [isConnected, sessionId, sendMessage])

  const sendSelection = useCallback((start: number, end: number, text: string) => {
    if (!isConnected || !sessionId) return

    sendMessage({
      type: 'selection_change',
      start,
      end,
      text
    })
  }, [isConnected, sessionId, sendMessage])

  const contextValue: CollaborationContextType = {
    sessionId,
    isConnected,
    participants,
    annotations,
    events,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    sendCursorPosition,
    sendSelection,
    activeUsers,
    userSelections
  }

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  )
}

export function useCollaboration() {
  const context = useContext(CollaborationContext)
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider')
  }
  return context
}

// Utility function to generate consistent colors for users
function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
  ]
  
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}