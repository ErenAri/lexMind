'use client'

import React, { useState, useEffect } from 'react'

interface PerformanceData {
  query_performance: Record<string, number>
  system_utilization: Record<string, number>
  user_activity: Record<string, number>
  collaboration_stats: Record<string, any>
  cost_efficiency: Record<string, number>
}

interface PerformanceMetricsProps {
  apiUrl?: string
  className?: string
}

export function PerformanceMetrics({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  className = '' 
}: PerformanceMetricsProps) {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'queries' | 'system' | 'collaboration' | 'cost'>('queries')

  // Load performance metrics
  useEffect(() => {
    const loadPerformanceData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${apiUrl}/analytics/performance/metrics`)
        
        if (!response.ok) {
          throw new Error('Failed to load performance data')
        }
        
        const perfData: PerformanceData = await response.json()
        setData(perfData)
        setError(null)
        
      } catch (err: any) {
        console.error('Failed to load performance metrics:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPerformanceData()
  }, [apiUrl])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p>Failed to load performance metrics</p>
          {error && <p className="text-sm mt-1">{error}</p>}
        </div>
      </div>
    )
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-600'
    if (latency < 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 60) return 'text-green-600'
    if (utilization < 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'queries', label: 'Queries', icon: '⚡' },
          { key: 'system', label: 'System', icon: '🖥️' },
          { key: 'collaboration', label: 'Users', icon: '👥' },
          { key: 'cost', label: 'Cost', icon: '💰' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Query Performance */}
      {activeTab === 'queries' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vector Search Performance */}
            {data.query_performance.read_avg_latency !== undefined && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="text-blue-600">🔍</div>
                  <h4 className="font-medium text-blue-900">Vector Search</h4>
                </div>
                <div className={`text-2xl font-bold ${getLatencyColor(data.query_performance.read_avg_latency)}`}>
                  {data.query_performance.read_avg_latency?.toFixed(1) || 0}ms
                </div>
                <div className="text-sm text-blue-700">
                  Cache Hit: {(data.query_performance.read_cache_hit_rate || 0).toFixed(1)}%
                </div>
              </div>
            )}

            {/* Analytics Performance */}
            {data.query_performance.analytics_avg_latency !== undefined && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="text-green-600">📊</div>
                  <h4 className="font-medium text-green-900">Analytics</h4>
                </div>
                <div className={`text-2xl font-bold ${getLatencyColor(data.query_performance.analytics_avg_latency)}`}>
                  {data.query_performance.analytics_avg_latency?.toFixed(1) || 0}ms
                </div>
                <div className="text-sm text-green-700">
                  TiFlash OLAP
                </div>
              </div>
            )}

            {/* Write Performance */}
            {data.query_performance.write_avg_latency !== undefined && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="text-purple-600">✏️</div>
                  <h4 className="font-medium text-purple-900">Write Ops</h4>
                </div>
                <div className={`text-2xl font-bold ${getLatencyColor(data.query_performance.write_avg_latency)}`}>
                  {data.query_performance.write_avg_latency?.toFixed(1) || 0}ms
                </div>
                <div className="text-sm text-purple-700">
                  Serverless
                </div>
              </div>
            )}
          </div>

          {/* Performance Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Query Type Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(data.query_performance)
                .filter(([key]) => key.includes('avg_latency'))
                .map(([key, value]) => {
                  const queryType = key.replace('_avg_latency', '').replace('_', ' ')
                  const percentage = Math.min(100, (value / 500) * 100) // Normalize to 500ms max
                  
                  return (
                    <div key={key} className="flex items-center space-x-3">
                      <div className="w-16 text-sm text-gray-600 capitalize">{queryType}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            value < 50 ? 'bg-green-500' :
                            value < 100 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-sm text-gray-700 text-right">{value.toFixed(1)}ms</div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* System Utilization */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.system_utilization).map(([metric, value]) => (
              <div key={metric} className="bg-white border rounded-lg p-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getUtilizationColor(value)}`}>
                    {typeof value === 'number' ? value.toFixed(1) : value}%
                  </div>
                  <div className="text-sm text-gray-600 capitalize mt-1">
                    {metric.replace('_', ' ').replace('usage', '')}
                  </div>
                </div>
                {/* Utilization Bar */}
                <div className="mt-2 bg-gray-200 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full ${
                      value < 60 ? 'bg-green-500' :
                      value < 80 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, value)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* TiDB Serverless Specific Metrics */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-3">TiDB Serverless Performance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-blue-700">Connection Pool</div>
                <div className="text-xl font-bold text-blue-900">
                  {data.system_utilization.connection_pool_usage?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-blue-600 mt-1">Optimal usage</div>
              </div>
              <div>
                <div className="text-sm text-blue-700">TiFlash Engine</div>
                <div className="text-xl font-bold text-blue-900">
                  {data.system_utilization.tiflash_cpu?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-blue-600 mt-1">OLAP workload</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Activity */}
      {activeTab === 'collaboration' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.collaboration_stats.active_sessions || 0}
              </div>
              <div className="text-sm text-green-700">Active Sessions</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data.collaboration_stats.participating_users || 0}
              </div>
              <div className="text-sm text-blue-700">Participants</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.collaboration_stats.avg_participants_per_session?.toFixed(1) || 0}
              </div>
              <div className="text-sm text-purple-700">Avg per Session</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(data.user_activity).reduce((sum: number, count) => sum + (count as number), 0)}
              </div>
              <div className="text-sm text-yellow-700">Total Events</div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">User Activity Types</h4>
            <div className="space-y-2">
              {Object.entries(data.user_activity).map(([activity, count]) => {
                const total = Object.values(data.user_activity).reduce((sum, c) => sum + c, 0)
                const percentage = total > 0 ? (count / total) * 100 : 0
                
                return (
                  <div key={activity} className="flex items-center space-x-3">
                    <div className="w-20 text-sm text-gray-600 capitalize">{activity.replace('_', ' ')}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-12 text-sm text-gray-700 text-right">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cost Efficiency */}
      {activeTab === 'cost' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.cost_efficiency).map(([metric, value]) => (
              <div key={metric} className="bg-white border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {typeof value === 'number' ? 
                    (metric.includes('cost') ? `$${value.toFixed(3)}` : value.toFixed(1)) 
                    : value
                  }
                </div>
                <div className="text-sm text-gray-600 capitalize mt-1">
                  {metric.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>

          {/* Cost Breakdown */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-medium text-green-900 mb-3">TiDB Serverless Cost Optimization</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-green-700">Efficiency Score</div>
                <div className="text-2xl font-bold text-green-900">
                  {data.cost_efficiency.tiflash_efficiency_score?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-green-600 mt-1">TiFlash optimization</div>
              </div>
              <div>
                <div className="text-sm text-green-700">Documents per Query</div>
                <div className="text-2xl font-bold text-green-900">
                  {data.cost_efficiency.documents_per_query?.toFixed(1) || 0}
                </div>
                <div className="text-xs text-green-600 mt-1">Processing efficiency</div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-green-100 rounded text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-green-600">💡</span>
                <strong className="text-green-800">Cost Optimization Tips</strong>
              </div>
              <p className="text-green-700 mt-1">
                TiFlash OLAP queries are 40% more cost-effective than traditional row-based analytics.
                Current efficiency score indicates excellent resource utilization.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}