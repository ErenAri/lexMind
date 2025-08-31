'use client'

import React, { useState, useEffect, useMemo } from 'react'

interface RiskTrendData {
  by_category: Record<string, number>
  by_regulation: Record<string, number>
  by_department: Record<string, number>
  trend_analysis: Array<{
    date: string
    risk_category: string
    risk_count: number
    avg_risk_level: number
  }>
  critical_risks: Array<{
    document_path: string
    regulation_code: string
    risk_score: number
    impact_score: number
    likelihood_score: number
    mitigation_status: string
    urgency: string
  }>
}

interface RiskTrendChartProps {
  apiUrl?: string
  timeRange?: string
  className?: string
}

export function RiskTrendChart({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeRange = '30d',
  className = '' 
}: RiskTrendChartProps) {
  const [data, setData] = useState<RiskTrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'trend' | 'distribution' | 'critical'>('trend')

  // Load risk distribution data
  useEffect(() => {
    const loadRiskData = async () => {
      try {
        setLoading(true)
        
        // Calculate date range based on timeRange
        const endDate = new Date()
        const startDate = new Date()
        
        switch (timeRange) {
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
        
        const params = new URLSearchParams({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        
        const response = await fetch(`${apiUrl}/analytics/risk/distribution?${params}`)
        
        if (!response.ok) {
          throw new Error('Failed to load risk data')
        }
        
        const riskData: RiskTrendData = await response.json()
        setData(riskData)
        setError(null)
        
      } catch (err: any) {
        console.error('Failed to load risk trend data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadRiskData()
  }, [apiUrl, timeRange])

  // Process trend data for visualization
  const trendVisualization = useMemo(() => {
    if (!data?.trend_analysis.length) return null

    const dates = [...new Set(data.trend_analysis.map(t => t.date))].sort()
    const categories = [...new Set(data.trend_analysis.map(t => t.risk_category))]
    
    return {
      dates,
      categories,
      series: categories.map(category => {
        const categoryData = dates.map(date => {
          const point = data.trend_analysis.find(t => t.date === date && t.risk_category === category)
          return point ? point.avg_risk_level : 0
        })
        return { category, data: categoryData }
      })
    }
  }, [data])

  // Generate SVG line chart
  const generateTrendChart = () => {
    if (!trendVisualization) return null

    const width = 300
    const height = 150
    const padding = { top: 10, right: 10, bottom: 30, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const maxValue = Math.max(...trendVisualization.series.flatMap(s => s.data)) || 10
    const minValue = Math.min(...trendVisualization.series.flatMap(s => s.data)) || 0
    const valueRange = maxValue - minValue || 1

    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6']

    return (
      <svg width={width} height={height} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding.top + ratio * chartHeight
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#F3F4F6"
              strokeWidth="1"
            />
          )
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = padding.top + (1 - ratio) * chartHeight
          const value = (minValue + ratio * valueRange).toFixed(1)
          return (
            <text
              key={index}
              x={padding.left - 5}
              y={y}
              textAnchor="end"
              fontSize="10"
              fill="#6B7280"
              dominantBaseline="middle"
            >
              {value}
            </text>
          )
        })}

        {/* Trend lines */}
        {trendVisualization.series.map((series, seriesIndex) => {
          const points = series.data.map((value, index) => {
            const x = padding.left + (index / (trendVisualization.dates.length - 1)) * chartWidth
            const y = padding.top + (1 - (value - minValue) / valueRange) * chartHeight
            return `${x},${y}`
          }).join(' ')

          return (
            <g key={series.category}>
              <polyline
                points={points}
                fill="none"
                stroke={colors[seriesIndex % colors.length]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {series.data.map((value, index) => {
                const x = padding.left + (index / (trendVisualization.dates.length - 1)) * chartWidth
                const y = padding.top + (1 - (value - minValue) / valueRange) * chartHeight
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={colors[seriesIndex % colors.length]}
                  />
                )
              })}
            </g>
          )
        })}

        {/* X-axis labels */}
        {trendVisualization.dates.map((date, index) => {
          if (index % Math.ceil(trendVisualization.dates.length / 4) !== 0) return null
          const x = padding.left + (index / (trendVisualization.dates.length - 1)) * chartWidth
          return (
            <text
              key={date}
              x={x}
              y={height - 5}
              textAnchor="middle"
              fontSize="10"
              fill="#6B7280"
            >
              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          )
        })}
      </svg>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p>Failed to load risk trend data</p>
          {error && <p className="text-sm mt-1">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Toggle */}
      <div className="flex space-x-2">
        {[
          { key: 'trend', label: 'Trend', icon: '📈' },
          { key: 'distribution', label: 'Distribution', icon: '📊' },
          { key: 'critical', label: 'Critical', icon: '🚨' }
        ].map((view) => (
          <button
            key={view.key}
            onClick={() => setActiveView(view.key as any)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              activeView === view.key
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {view.icon} {view.label}
          </button>
        ))}
      </div>

      {/* Trend View */}
      {activeView === 'trend' && (
        <div className="space-y-4">
          {/* Chart */}
          <div className="bg-gray-50 rounded-lg p-4">
            {generateTrendChart()}
          </div>

          {/* Legend */}
          {trendVisualization && (
            <div className="flex flex-wrap gap-4 text-sm">
              {trendVisualization.categories.map((category, index) => (
                <div key={category} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'][index % 4] }}
                  ></div>
                  <span className="capitalize">{category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Distribution View */}
      {activeView === 'distribution' && (
        <div className="space-y-4">
          {/* Risk by Category */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Risk by Category</h4>
            <div className="space-y-2">
              {Object.entries(data.by_category).map(([category, count]) => {
                const total = Object.values(data.by_category).reduce((sum, c) => sum + c, 0)
                const percentage = total > 0 ? (count / total) * 100 : 0
                
                return (
                  <div key={category} className="flex items-center space-x-3">
                    <div className="w-20 text-sm text-gray-600 capitalize">{category}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          category === 'critical' ? 'bg-red-500' :
                          category === 'high' ? 'bg-orange-500' :
                          category === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-12 text-sm text-gray-700 text-right">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Risk Regulations */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Top Risk Regulations</h4>
            <div className="space-y-2">
              {Object.entries(data.by_regulation)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([regulation, score]) => (
                <div key={regulation} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{regulation}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{score.toFixed(1)}/10</span>
                    <div className={`w-2 h-2 rounded-full ${
                      score >= 9 ? 'bg-red-600' :
                      score >= 7 ? 'bg-red-400' :
                      score >= 4 ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Critical Risks View */}
      {activeView === 'critical' && (
        <div className="space-y-3">
          {data.critical_risks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🎉</div>
              <p>No critical risks detected</p>
              <p className="text-sm mt-1">System compliance is looking good!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.critical_risks.slice(0, 5).map((risk, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          risk.urgency === 'immediate' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {risk.urgency.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600">{risk.regulation_code}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {risk.document_path.split('/').pop()}
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-xs">
                        <span className="text-red-600">Risk: {risk.risk_score.toFixed(1)}/10</span>
                        <span className="text-gray-600">Impact: {risk.impact_score.toFixed(1)}/10</span>
                        <span className="text-gray-600">Likelihood: {risk.likelihood_score.toFixed(1)}/10</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">Status:</span>
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          risk.mitigation_status === 'none' ? 'bg-red-100 text-red-700' :
                          risk.mitigation_status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {risk.mitigation_status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}