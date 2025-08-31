'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string | null
  onMessage?: (message: any) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  shouldReconnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

interface UseWebSocketReturn {
  isConnected: boolean
  sendMessage: (message: any) => void
  lastMessage: any
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  shouldReconnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  
  const ws = useRef<WebSocket | null>(null)
  const reconnectCount = useRef(0)
  const shouldConnect = useRef(true)
  const reconnectTimer = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (!url || !shouldConnect.current) return

    try {
      setConnectionState('connecting')
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        setIsConnected(true)
        setConnectionState('connected')
        reconnectCount.current = 0
        onOpen?.()
      }

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.current.onclose = () => {
        setIsConnected(false)
        setConnectionState('disconnected')
        onClose?.()

        // Attempt to reconnect if enabled and not manually closed
        if (shouldReconnect && shouldConnect.current && reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++
          reconnectTimer.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.current.onerror = (error) => {
        setConnectionState('error')
        onError?.(error)
        console.error('WebSocket error:', error)
      }

    } catch (error) {
      setConnectionState('error')
      console.error('Failed to create WebSocket connection:', error)
    }
  }, [url, onMessage, onOpen, onClose, onError, shouldReconnect, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    shouldConnect.current = false
    
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
    }
    
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    
    setIsConnected(false)
    setConnectionState('disconnected')
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
      }
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message)
    }
  }, [])

  // Connect when URL changes
  useEffect(() => {
    if (url) {
      shouldConnect.current = true
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [url, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    sendMessage,
    lastMessage,
    connectionState
  }
}