'use client'

import React, { useState } from 'react'

interface ActionItem {
  title: string
  description: string
  assignee: string
  due_date: string
  status: string
}

interface ActionItemsPanelProps {
  actionItems: ActionItem[]
  className?: string
}

export function ActionItemsPanel({ actionItems, className = '' }: ActionItemsPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'assignee'>('due_date')

  // Filter and sort action items
  const filteredItems = actionItems
    .filter(item => selectedStatus === 'all' || item.status === selectedStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'assignee':
          return a.assignee.localeCompare(b.assignee)
        case 'priority':
          // Infer priority from description/title keywords
          const getPriority = (item: ActionItem) => {
            const text = `${item.title} ${item.description}`.toLowerCase()
            if (text.includes('critical') || text.includes('immediate')) return 3
            if (text.includes('high') || text.includes('urgent')) return 2
            if (text.includes('medium')) return 1
            return 0
          }
          return getPriority(b) - getPriority(a)
        default:
          return 0
      }
    })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'blocked':
        return 'bg-red-100 text-red-800'
      case 'open':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getDueDateColor = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) return 'text-red-600' // Overdue
    if (daysUntilDue <= 3) return 'text-orange-600' // Due soon
    if (daysUntilDue <= 7) return 'text-yellow-600' // Due this week
    return 'text-gray-600' // Future
  }

  const getPriorityFromContent = (item: ActionItem): 'critical' | 'high' | 'medium' | 'low' => {
    const text = `${item.title} ${item.description}`.toLowerCase()
    if (text.includes('critical') || text.includes('immediate')) return 'critical'
    if (text.includes('high') || text.includes('urgent')) return 'high'
    if (text.includes('medium')) return 'medium'
    return 'low'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDueDate = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue === 0) return 'Today'
    if (daysUntilDue === 1) return 'Tomorrow'
    if (daysUntilDue === -1) return 'Yesterday'
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`
    if (daysUntilDue <= 7) return `${daysUntilDue} days`
    
    return due.toLocaleDateString()
  }

  if (actionItems.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-gray-600">No action items</p>
        <p className="text-sm text-gray-500 mt-1">All compliance tasks are up to date!</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-sm border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-red-600 font-medium">
            {actionItems.filter(item => {
              const due = new Date(item.due_date)
              const today = new Date()
              return due < today && item.status !== 'completed'
            }).length} overdue
          </div>
          <div className="text-yellow-600 font-medium">
            {actionItems.filter(item => item.status === 'open').length} open
          </div>
        </div>
      </div>

      {/* Action Items List */}
      <div className="space-y-3">
        {filteredItems.map((item, index) => {
          const priority = getPriorityFromContent(item)
          const isOverdue = new Date(item.due_date) < new Date() && item.status !== 'completed'
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 transition-colors hover:bg-gray-50 ${
                isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Title and Priority */}
                  <div className="flex items-start space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900 flex-1">{item.title}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(priority)}`}>
                      {priority.toUpperCase()}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                  {/* Footer Info */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-4">
                      {/* Assignee */}
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-500">👤</span>
                        <span className="text-gray-700">{item.assignee}</span>
                      </div>

                      {/* Due Date */}
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-500">📅</span>
                        <span className={getDueDateColor(item.due_date)}>
                          {formatDueDate(item.due_date)}
                          {isOverdue && <span className="ml-1 text-red-600 font-medium">⚠️</span>}
                        </span>
                      </div>

                      {/* Status */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center space-x-2">
                      {item.status === 'open' && (
                        <button className="text-blue-600 hover:text-blue-800 text-xs">
                          Start
                        </button>
                      )}
                      {item.status === 'in_progress' && (
                        <button className="text-green-600 hover:text-green-800 text-xs">
                          Complete
                        </button>
                      )}
                      <button className="text-gray-400 hover:text-gray-600 text-xs">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Indicator for Overdue Items */}
              {isOverdue && (
                <div className="mt-3 p-2 bg-red-100 rounded text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-600">🚨</span>
                    <span className="text-red-800 font-medium">
                      This item is overdue and requires immediate attention
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredItems.length === 0 && selectedStatus !== 'all' && (
        <div className="text-center py-8 text-gray-500">
          <p>No action items with status "{selectedStatus}"</p>
        </div>
      )}

      {/* Footer Summary */}
      <div className="border-t pt-3 text-xs text-gray-500 text-center">
        Showing {filteredItems.length} of {actionItems.length} action items
      </div>
    </div>
  )
}