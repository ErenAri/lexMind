'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ComplianceHeatMap } from './ComplianceHeatMap'
import { RiskTrendChart } from './RiskTrendChart'
import { PerformanceMetrics } from './PerformanceMetrics'
import { ComplianceCoverageChart } from './ComplianceCoverageChart'
import { RealTimeMetrics } from './RealTimeMetrics'
import { ActionItemsPanel } from './ActionItemsPanel'

interface ExecutiveSummary {
  reporting_period: {
    start_date: string
    end_date: string
  }
  key_metrics: {
    total_regulations_tracked: number
    overall_compliance_score: number
    uncovered_regulations: number
    critical_risks: number
    high_risk_regulations: number
    system_performance_score: number
    active_collaborators: number
  }
  compliance_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  trends: {
    compliance_trend: string
    risk_trend: string
    performance_trend: string
    collaboration_trend: string
  }
  recommendations: Array<{
    priority: string
    category: string
    title: string
    description: string
    estimated_effort: string
    expected_impact: string
  }>
  action_items: Array<{
    title: string
    description: string
    assignee: string
    due_date: string
    status: string
  }>
}

interface ExecutiveDashboardProps {
  apiUrl?: string
  refreshInterval?: number // seconds
  className?: string
}

export function ExecutiveDashboard({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  refreshInterval = 30,
  className = ''
}: ExecutiveDashboardProps) {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d')

  // Load executive summary
  const loadSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      
      // Set date range based on selection
      const endDate = new Date()
      const startDate = new Date()
      
      switch (selectedTimeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }
      
      params.set('start_date', startDate.toISOString().split('T')[0])
      params.set('end_date', endDate.toISOString().split('T')[0])
      
      const response = await fetch(`${apiUrl}/analytics/executive/summary?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load summary: ${response.statusText}`)
      }
      
      const data: ExecutiveSummary = await response.json()
      setSummary(data)
      setLastUpdated(new Date())
      setError(null)
      
    } catch (err: any) {
      console.error('Failed to load executive summary:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, selectedTimeRange])

  // Auto-refresh effect
  useEffect(() => {
    loadSummary()
    
    if (autoRefresh) {
      const interval = setInterval(loadSummary, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [loadSummary, autoRefresh, refreshInterval])

  // Manual refresh
  const handleRefresh = useCallback(() => {
    setLoading(true)
    loadSummary()
  }, [loadSummary])

  if (loading && !summary) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Executive Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center ${className}`}>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!summary) return null

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
      case 'growing':
      case 'excellent':
        return '📈'
      case 'declining':
      case 'increasing':
        return '📉'
      case 'stable':
        return '📊'
      default:
        return '⚡'
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${className}`}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Executive Compliance Dashboard
              </h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(summary.risk_level)}`}>
                {summary.risk_level.toUpperCase()} RISK
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
              
              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {autoRefresh ? '🟢 Live' : '⏸️ Paused'}
              </button>
              
              {/* Manual Refresh */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? '↻' : '🔄'} Refresh
              </button>
              
              {/* Last Updated */}
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {/* Compliance Score */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {Math.round(summary.key_metrics.overall_compliance_score)}%
              </div>
              <div className="text-sm text-gray-600">Compliance Score</div>
              <div className="text-xs text-gray-500 mt-1">
                {getTrendIcon(summary.trends.compliance_trend)} {summary.trends.compliance_trend}
              </div>
            </div>
          </div>

          {/* Total Regulations */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">
                {summary.key_metrics.total_regulations_tracked}
              </div>
              <div className="text-sm text-gray-600">Regulations</div>
              <div className="text-xs text-green-600 mt-1">✓ Tracked</div>
            </div>
          </div>

          {/* Critical Risks */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-1">
                {summary.key_metrics.critical_risks}
              </div>
              <div className="text-sm text-gray-600">Critical Risks</div>
              <div className="text-xs text-red-600 mt-1">
                {getTrendIcon(summary.trends.risk_trend)} {summary.trends.risk_trend}
              </div>
            </div>
          </div>

          {/* Uncovered Regs */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {summary.key_metrics.uncovered_regulations}
              </div>
              <div className="text-sm text-gray-600">Uncovered</div>
              <div className="text-xs text-orange-600 mt-1">⚠️ Action Needed</div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {summary.key_metrics.system_performance_score}%
              </div>
              <div className="text-sm text-gray-600">Performance</div>
              <div className="text-xs text-green-600 mt-1">
                {getTrendIcon(summary.trends.performance_trend)} {summary.trends.performance_trend}
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {summary.key_metrics.active_collaborators}
              </div>
              <div className="text-sm text-gray-600">Active Users</div>
              <div className="text-xs text-purple-600 mt-1">
                {getTrendIcon(summary.trends.collaboration_trend)} {summary.trends.collaboration_trend}
              </div>
            </div>
          </div>

          {/* High Risk Regs */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-1">
                {summary.key_metrics.high_risk_regulations}
              </div>
              <div className="text-sm text-gray-600">High Risk</div>
              <div className="text-xs text-yellow-600 mt-1">⚡ Priority</div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Compliance Heat Map - Takes up 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 h-full">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Compliance Risk Heat Map</h3>
                <p className="text-sm text-gray-600 mt-1">Real-time risk assessment across regulations and departments</p>
              </div>
              <div className="p-6">
                <ComplianceHeatMap apiUrl={apiUrl} />
              </div>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Live Metrics</h3>
              <p className="text-sm text-gray-600 mt-1">Real-time system activity</p>
            </div>
            <div className="p-6">
              <RealTimeMetrics apiUrl={apiUrl} refreshInterval={5} />
            </div>
          </div>
        </div>

        {/* Secondary Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Trend Chart */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Risk Trends</h3>
              <p className="text-sm text-gray-600 mt-1">Historical risk analysis and predictions</p>
            </div>
            <div className="p-6">
              <RiskTrendChart apiUrl={apiUrl} timeRange={selectedTimeRange} />
            </div>
          </div>

          {/* Compliance Coverage */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Coverage Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">Regulation coverage by confidence level</p>
            </div>
            <div className="p-6">
              <ComplianceCoverageChart apiUrl={apiUrl} />
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">System Performance</h3>
            <p className="text-sm text-gray-600 mt-1">TiDB Serverless performance metrics and optimization insights</p>
          </div>
          <div className="p-6">
            <PerformanceMetrics apiUrl={apiUrl} />
          </div>
        </div>

        {/* Action Items and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recommendations */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">AI Recommendations</h3>
              <p className="text-sm text-gray-600 mt-1">Intelligent compliance optimization suggestions</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {summary.recommendations.map((rec, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {rec.priority.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">{rec.category}</span>
                        </div>
                        <h4 className="font-medium text-gray-900 mt-1">{rec.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>⏱️ {rec.estimated_effort}</span>
                          <span>📈 {rec.expected_impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
              <p className="text-sm text-gray-600 mt-1">Critical tasks requiring immediate attention</p>
            </div>
            <div className="p-6">
              <ActionItemsPanel actionItems={summary.action_items} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}