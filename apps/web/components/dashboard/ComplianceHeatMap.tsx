'use client'

import React, { useState, useEffect, useMemo } from 'react'

interface ComplianceHeatMapData {
  regulations: string[]
  departments: string[]
  risk_matrix: number[][]
  metadata: {
    generated_at: string
    total_assessments: number
    average_risk_score: number
    high_risk_regulations: number
    coverage_percentage: number
    risk_scale: {
      low: string
      medium: string
      high: string
      critical: string
    }
  }
}

interface ComplianceHeatMapProps {
  apiUrl?: string
  className?: string
}

export function ComplianceHeatMap({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  className = '' 
}: ComplianceHeatMapProps) {
  const [data, setData] = useState<ComplianceHeatMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    regulation: string
    department: string
    riskScore: number
  } | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{
    regulation: string
    department: string
    riskScore: number
  } | null>(null)

  // Load heatmap data
  useEffect(() => {
    const loadHeatmapData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${apiUrl}/analytics/compliance/heatmap`)
        
        if (!response.ok) {
          throw new Error('Failed to load heatmap data')
        }
        
        const heatmapData: ComplianceHeatMapData = await response.json()
        setData(heatmapData)
        setError(null)
        
      } catch (err: any) {
        console.error('Failed to load heatmap:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadHeatmapData()
  }, [apiUrl])

  // Get color for risk score
  const getRiskColor = (riskScore: number): string => {
    if (riskScore >= 9.0) return 'bg-red-600'      // Critical
    if (riskScore >= 7.0) return 'bg-red-400'      // High
    if (riskScore >= 4.0) return 'bg-yellow-400'   // Medium  
    return 'bg-green-400'                          // Low
  }

  // Get text color for risk score
  const getRiskTextColor = (riskScore: number): string => {
    if (riskScore >= 4.0) return 'text-white'
    return 'text-gray-800'
  }

  // Get risk level label
  const getRiskLevel = (riskScore: number): string => {
    if (riskScore >= 9.0) return 'CRITICAL'
    if (riskScore >= 7.0) return 'HIGH'
    if (riskScore >= 4.0) return 'MEDIUM'
    return 'LOW'
  }

  // Calculate statistics
  const stats = useMemo(() => {
    if (!data) return null

    const allScores = data.risk_matrix.flat()
    const criticalCount = allScores.filter(score => score >= 9.0).length
    const highCount = allScores.filter(score => score >= 7.0 && score < 9.0).length
    const mediumCount = allScores.filter(score => score >= 4.0 && score < 7.0).length
    const lowCount = allScores.filter(score => score < 4.0).length
    
    return {
      total: allScores.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      averageRisk: allScores.reduce((sum, score) => sum + score, 0) / allScores.length
    }
  }, [data])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
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
          <p>Failed to load compliance heatmap</p>
          {error && <p className="text-sm mt-1">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Legend and Stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Risk Scale Legend */}
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Risk Level:</span>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span className="text-xs text-gray-600">Low (0-3.9)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-400 rounded"></div>
              <span className="text-xs text-gray-600">Medium (4.0-6.9)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span className="text-xs text-gray-600">High (7.0-8.9)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span className="text-xs text-gray-600">Critical (9.0+)</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="flex items-center space-x-4 text-sm">
            <div className="text-red-600 font-medium">
              🚨 {stats.critical} Critical
            </div>
            <div className="text-orange-600 font-medium">
              ⚠️ {stats.high} High
            </div>
            <div className="text-gray-600">
              📊 Avg: {stats.averageRisk.toFixed(1)}
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="relative overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Department Headers */}
          <div className="flex">
            <div className="w-32 flex-shrink-0"></div> {/* Space for regulation labels */}
            {data.departments.map((dept) => (
              <div 
                key={dept}
                className="w-24 px-2 py-3 text-center text-xs font-medium text-gray-700 bg-gray-50 border-b border-gray-200"
              >
                {dept}
              </div>
            ))}
          </div>

          {/* Heatmap Rows */}
          {data.regulations.map((regulation, regIndex) => (
            <div key={regulation} className="flex hover:bg-gray-50/50">
              {/* Regulation Label */}
              <div className="w-32 flex-shrink-0 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border-r border-gray-200 flex items-center">
                <div className="truncate" title={regulation}>
                  {regulation}
                </div>
              </div>

              {/* Risk Cells */}
              {data.departments.map((dept, deptIndex) => {
                const riskScore = data.risk_matrix[regIndex][deptIndex]
                const isHovered = hoveredCell?.regulation === regulation && hoveredCell?.department === dept
                const isSelected = selectedCell?.regulation === regulation && selectedCell?.department === dept

                return (
                  <div
                    key={`${regulation}-${dept}`}
                    className={`w-24 h-16 border border-gray-200 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg relative ${
                      isSelected ? 'ring-2 ring-blue-500 z-10' : ''
                    } ${isHovered ? 'z-10' : ''}`}
                    onMouseEnter={() => setHoveredCell({ regulation, department: dept, riskScore })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => setSelectedCell({ regulation, department: dept, riskScore })}
                  >
                    <div 
                      className={`w-full h-full flex items-center justify-center ${getRiskColor(riskScore)} ${getRiskTextColor(riskScore)} font-semibold text-xs`}
                    >
                      {riskScore.toFixed(1)}
                    </div>

                    {/* Hover Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-20">
                        <div className="font-semibold">{regulation}</div>
                        <div>{dept}</div>
                        <div className="mt-1">
                          Risk: {riskScore.toFixed(1)}/10 ({getRiskLevel(riskScore)})
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Cell Details */}
      {selectedCell && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-blue-900">Risk Assessment Detail</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div><strong>Regulation:</strong> {selectedCell.regulation}</div>
                <div><strong>Department:</strong> {selectedCell.department}</div>
                <div className="flex items-center space-x-2">
                  <strong>Risk Score:</strong>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedCell.riskScore >= 9.0 ? 'bg-red-100 text-red-800' :
                    selectedCell.riskScore >= 7.0 ? 'bg-red-100 text-red-700' :
                    selectedCell.riskScore >= 4.0 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedCell.riskScore.toFixed(1)}/10 - {getRiskLevel(selectedCell.riskScore)}
                  </span>
                </div>
              </div>
              
              {selectedCell.riskScore >= 7.0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <strong className="text-yellow-800">Action Required</strong>
                  </div>
                  <p className="text-yellow-700 mt-1">
                    This high-risk area requires immediate attention and mitigation planning.
                  </p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setSelectedCell(null)}
              className="text-blue-400 hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Metadata Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
        <div>
          Generated: {new Date(data.metadata.generated_at).toLocaleString()}
        </div>
        <div className="flex items-center space-x-4">
          <span>📊 {data.metadata.total_assessments} assessments</span>
          <span>📈 {data.metadata.coverage_percentage.toFixed(1)}% coverage</span>
          <span>🎯 {data.metadata.high_risk_regulations} high-risk</span>
        </div>
      </div>
    </div>
  )
}