'use client'

import React from 'react'
import { useCollaboration } from './CollaborationProvider'

interface LiveUserIndicatorProps {
  className?: string
}

export function LiveUserIndicator({ className = '' }: LiveUserIndicatorProps) {
  const { isConnected, participants, events } = useCollaboration()

  const recentActivity = events.slice(-5).reverse()
  
  if (!isConnected) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="text-sm text-gray-600">Disconnected</span>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-green-600 font-medium">
          Live Collaboration Active
        </span>
      </div>

      {/* Active Participants */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">
          Active Users ({participants.length})
        </h4>
        <div className="flex -space-x-2">
          {participants.map((participant) => (
            <div
              key={participant.user_id}
              className="relative"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white"
                style={{ 
                  backgroundColor: participant.color || '#6B7280'
                }}
                title={`${participant.user_id} (${participant.role})`}
              >
                {getInitials(participant.user_id)}
              </div>
              {participant.location && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">
                    {getLocationFlag(participant.location)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">Recent Activity</h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {recentActivity.length === 0 ? (
            <p className="text-xs text-gray-500">No recent activity</p>
          ) : (
            recentActivity.map((event, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                  style={{ 
                    backgroundColor: getEventColor(event.type)
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">
                      {getUserDisplayName(event.user_id)}
                    </span>
                    {' '}
                    {getEventDescription(event.type, event.data)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {formatRelativeTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Collaboration Stats */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">
            {events.filter(e => e.type === 'annotation').length}
          </div>
          <div className="text-xs text-gray-500">Annotations</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">
            {participants.length}
          </div>
          <div className="text-xs text-gray-500">Contributors</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="pt-2 border-t">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              // Copy collaboration session URL
              const url = `${window.location.origin}${window.location.pathname}?collab=true`
              navigator.clipboard.writeText(url)
            }}
            className="flex-1 px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            Share Link
          </button>
          <button
            onClick={() => {
              // Export annotations
              const dataStr = JSON.stringify(events, null, 2)
              const dataBlob = new Blob([dataStr], { type: 'application/json' })
              const url = URL.createObjectURL(dataBlob)
              const link = document.createElement('a')
              link.href = url
              link.download = 'collaboration-session.json'
              link.click()
            }}
            className="flex-1 px-3 py-1 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}

function getInitials(userId: string): string {
  const name = userId.split('@')[0]
  return name.split('.').map(part => part[0]?.toUpperCase() || '').join('').slice(0, 2)
}

function getLocationFlag(location: string): string {
  const flags: Record<string, string> = {
    'NYC': '🗽',
    'London': '🇬🇧', 
    'Tokyo': '🗾',
    'SF': '🌉',
    'LA': '🌴'
  }
  return flags[location] || '🌐'
}

function getUserDisplayName(userId: string): string {
  return userId.split('@')[0].replace('.', ' ')
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'user_joined': return '#10B981'
    case 'user_left': return '#EF4444'
    case 'annotation': return '#3B82F6'
    case 'cursor_move': return '#8B5CF6'
    case 'selection_change': return '#F59E0B'
    default: return '#6B7280'
  }
}

function getEventDescription(eventType: string, data: any): string {
  switch (eventType) {
    case 'user_joined': return 'joined the session'
    case 'user_left': return 'left the session'
    case 'annotation': return `added a ${data?.annotation_type || 'note'}`
    case 'cursor_move': return 'moved cursor'
    case 'selection_change': return 'selected text'
    default: return eventType.replace('_', ' ')
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now.getTime() - time.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}