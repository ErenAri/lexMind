'use client'

import React, { useState, useEffect, useRef } from 'react'

interface RealTimeMetricsData {
  timestamp: string
  active_users: number
  avg_query_latency_ms: number
  recent_queries: number
  recent_risk_assessments: number
  avg_recent_risk_score: number
  system_status: string
  tiflash_status: string
}

interface RealTimeMetricsProps {
  apiUrl?: string
  refreshInterval?: number // seconds
  className?: string
}

interface MetricHistory {
  timestamp: Date
  value: number
}

export function RealTimeMetrics({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  refreshInterval = 5,
  className = '' 
}: RealTimeMetricsProps) {
  const [data, setData] = useState<RealTimeMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(true)
  
  // History for sparklines
  const [userHistory, setUserHistory] = useState<MetricHistory[]>([])
  const [latencyHistory, setLatencyHistory] = useState<MetricHistory[]>([])
  const [riskHistory, setRiskHistory] = useState<MetricHistory[]>([])
  
  const intervalRef = useRef<NodeJS.Timeout>()

  // Load real-time metrics
  const loadMetrics = async () => {
    try {
      const response = await fetch(`${apiUrl}/analytics/realtime/metrics`)
      
      if (!response.ok) {
        throw new Error('Failed to load metrics')
      }
      
      const metricsData: RealTimeMetricsData = await response.json()
      const timestamp = new Date(metricsData.timestamp)
      
      setData(metricsData)
      setError(null)
      
      // Update histories (keep last 20 points)
      setUserHistory(prev => {
        const newHistory = [...prev, { timestamp, value: metricsData.active_users }]
        return newHistory.slice(-20)
      })
      
      setLatencyHistory(prev => {
        const newHistory = [...prev, { timestamp, value: metricsData.avg_query_latency_ms }]
        return newHistory.slice(-20)
      })
      
      setRiskHistory(prev => {
        const newHistory = [...prev, { timestamp, value: metricsData.avg_recent_risk_score }]
        return newHistory.slice(-20)
      })
      
    } catch (err: any) {
      console.error('Failed to load real-time metrics:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    loadMetrics()
    
    if (isLive) {
      intervalRef.current = setInterval(loadMetrics, refreshInterval * 1000)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isLive, refreshInterval, apiUrl])

  // Toggle live updates
  const toggleLive = () => {
    setIsLive(!isLive)
  }

  // Generate sparkline SVG
  const generateSparkline = (history: MetricHistory[], color: string = '#3B82F6'): string => {
    if (history.length < 2) return ''
    
    const width = 60
    const height = 20
    const padding = 2
    
    const values = history.map(h => h.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const valueRange = maxValue - minValue || 1
    
    const points = history.map((h, index) => {
      const x = padding + (index / (history.length - 1)) * (width - 2 * padding)
      const y = height - padding - ((h.value - minValue) / valueRange) * (height - 2 * padding)
      return `${x},${y}`
    }).join(' ')
    
    return `
      <svg width="${width}" height="${height}" className="inline-block">
        <polyline 
          points="${points}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `
  }

  if (loading && !data) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-500 mb-2">
          <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-600'
    if (latency < 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskColor = (risk: number) => {
    if (risk < 4) return 'text-green-600'
    if (risk < 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Live Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-sm font-medium text-gray-700">
            {isLive ? 'Live' : 'Paused'}
          </span>
        </div>
        <button
          onClick={toggleLive}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            isLive 
              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isLive ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">System</span>
          <span className={`font-medium ${getStatusColor(data.system_status)}`}>
            {data.system_status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">TiFlash</span>
          <span className={`font-medium ${getStatusColor(data.tiflash_status)}`}>
            {data.tiflash_status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="space-y-3">
        {/* Active Users */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="text-blue-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-blue-900">{data.active_users}</div>
              <div className="text-xs text-blue-700">Active Users</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {userHistory.length > 1 && (
              <div dangerouslySetInnerHTML={{ 
                __html: generateSparkline(userHistory, '#3B82F6') 
              }} />
            )}
          </div>
        </div>

        {/* Query Performance */}
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className={`font-semibold ${getLatencyColor(data.avg_query_latency_ms)}`}>
                {data.avg_query_latency_ms.toFixed(1)}ms
              </div>
              <div className="text-xs text-green-700">Avg Latency</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {latencyHistory.length > 1 && (
              <div dangerouslySetInnerHTML={{ 
                __html: generateSparkline(latencyHistory, '#10B981') 
              }} />
            )}
            <div className="text-xs text-gray-500">
              {data.recent_queries} queries
            </div>
          </div>
        </div>

        {/* Risk Assessment Activity */}
        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="text-yellow-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className={`font-semibold ${getRiskColor(data.avg_recent_risk_score)}`}>
                {data.avg_recent_risk_score.toFixed(1)}/10
              </div>
              <div className="text-xs text-yellow-700">Recent Risk</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {riskHistory.length > 1 && (
              <div dangerouslySetInnerHTML={{ 
                __html: generateSparkline(riskHistory, '#F59E0B') 
              }} />
            )}
            <div className="text-xs text-gray-500">
              {data.recent_risk_assessments} assessments
            </div>
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
        <div className="text-center">
          <div className="text-2xl">⚡</div>
          <div className="text-xs text-gray-600 mt-1">TiDB Serverless</div>
          <div className="text-xs font-medium text-green-600">Optimized</div>
        </div>
        <div className="text-center">
          <div className="text-2xl">🔍</div>
          <div className="text-xs text-gray-600 mt-1">Vector Search</div>
          <div className="text-xs font-medium text-blue-600">Active</div>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 text-center pt-2 border-t">
        Last updated: {data ? new Date(data.timestamp).toLocaleTimeString() : 'Never'}
      </div>
    </div>
  )
}