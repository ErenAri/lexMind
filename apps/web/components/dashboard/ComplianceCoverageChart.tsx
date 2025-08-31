'use client'

import React, { useState, useEffect } from 'react'

interface ComplianceCoverageData {
  regulation_coverage: Record<string, number>
  uncovered_regulations: string[]
  high_risk_gaps: Array<{
    regulation_code: string
    avg_risk_score: number
    assessment_count: number
    last_assessment: string | null
  }>
  coverage_trend: Array<{
    date: string
    regulation_type: string
    coverage_percentage: number
  }>
  overall_score: number
}

interface ComplianceCoverageChartProps {
  apiUrl?: string
  className?: string
}

export function ComplianceCoverageChart({ 
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  className = '' 
}: ComplianceCoverageChartProps) {
  const [data, setData] = useState<ComplianceCoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'coverage' | 'gaps' | 'trend'>('coverage')

  // Load compliance coverage data
  useEffect(() => {
    const loadCoverageData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${apiUrl}/analytics/compliance/coverage`)
        
        if (!response.ok) {
          throw new Error('Failed to load compliance coverage data')
        }
        
        const coverageData: ComplianceCoverageData = await response.json()
        setData(coverageData)
        setError(null)
        
      } catch (err: any) {
        console.error('Failed to load compliance coverage:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadCoverageData()
  }, [apiUrl])

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
          <p>Failed to load compliance coverage data</p>
          {error && <p className="text-sm mt-1">{error}</p>}
        </div>
      </div>
    )
  }

  const getCoverageColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    if (score >= 0.5) return 'text-orange-600'
    return 'text-red-600'
  }

  const getCoverageBarColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-500'
    if (score >= 0.7) return 'bg-yellow-500'
    if (score >= 0.5) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Score */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-blue-900">Overall Compliance Score</h3>
            <div className={`text-3xl font-bold ${getCoverageColor(data.overall_score)} mt-1`}>
              {(data.overall_score * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-700">
              {Object.keys(data.regulation_coverage).length} regulations tracked
            </div>
            <div className="text-sm text-red-600 mt-1">
              {data.uncovered_regulations.length} uncovered
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2">
        {[
          { key: 'coverage', label: 'Coverage', icon: '📊' },
          { key: 'gaps', label: 'Gaps', icon: '⚠️' },
          { key: 'trend', label: 'Trend', icon: '📈' }
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

      {/* Coverage View */}
      {activeView === 'coverage' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Regulation Coverage by Confidence</h4>
          <div className="space-y-2">
            {Object.entries(data.regulation_coverage)
              .sort(([,a], [,b]) => b - a)
              .map(([regulation, score]) => (
              <div key={regulation} className="flex items-center space-x-3">
                <div className="w-32 text-sm text-gray-700 truncate" title={regulation}>
                  {regulation}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${getCoverageBarColor(score)}`}
                    style={{ width: `${score * 100}%` }}
                  ></div>
                </div>
                <div className={`w-16 text-sm font-medium text-right ${getCoverageColor(score)}`}>
                  {(score * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>

          {/* Coverage Statistics */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(data.regulation_coverage).filter(score => score >= 0.8).length}
              </div>
              <div className="text-xs text-gray-600">High Coverage (≥80%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(data.regulation_coverage).filter(score => score >= 0.5 && score < 0.8).length}
              </div>
              <div className="text-xs text-gray-600">Medium Coverage (50-79%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {Object.values(data.regulation_coverage).filter(score => score < 0.5).length}
              </div>
              <div className="text-xs text-gray-600">Low Coverage (<50%)</div>
            </div>
          </div>
        </div>
      )}

      {/* Gaps View */}
      {activeView === 'gaps' && (
        <div className="space-y-4">
          {/* Uncovered Regulations */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Uncovered Regulations ({data.uncovered_regulations.length})
            </h4>
            {data.uncovered_regulations.length === 0 ? (
              <div className="text-center py-8 text-green-600">
                <div className="text-4xl mb-2">🎉</div>
                <p>All regulations have coverage!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.uncovered_regulations.map((regulation) => (
                  <div key={regulation} className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-red-800">{regulation}</span>
                    </div>
                    <div className="text-xs text-red-600 mt-1">No compliance documentation found</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High Risk Gaps */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              High Risk Gaps ({data.high_risk_gaps.length})
            </h4>
            {data.high_risk_gaps.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No high-risk gaps detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.high_risk_gaps.map((gap, index) => (
                  <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-orange-900">{gap.regulation_code}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            gap.avg_risk_score >= 8 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            Risk: {gap.avg_risk_score.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="text-xs text-orange-700">
                          {gap.assessment_count} assessments
                          {gap.last_assessment && (
                            <> • Last: {new Date(gap.last_assessment).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend View */}
      {activeView === 'trend' && (
        <div className="space-y-4">
          {data.coverage_trend.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No trend data available</p>
              <p className="text-sm mt-1">Coverage trends will appear as data is collected over time</p>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Coverage Trends Over Time</h4>
              <div className="space-y-3">
                {/* Group by regulation type */}
                {Array.from(new Set(data.coverage_trend.map(t => t.regulation_type))).map(regType => {
                  const typeData = data.coverage_trend
                    .filter(t => t.regulation_type === regType)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                  if (typeData.length === 0) return null

                  const latestCoverage = typeData[typeData.length - 1]?.coverage_percentage || 0
                  const previousCoverage = typeData[typeData.length - 2]?.coverage_percentage || latestCoverage
                  const trend = latestCoverage > previousCoverage ? 'improving' : 
                              latestCoverage < previousCoverage ? 'declining' : 'stable'

                  return (
                    <div key={regType} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900 capitalize">{regType}</h5>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${
                            trend === 'improving' ? 'text-green-600' :
                            trend === 'declining' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '📊'} {trend}
                          </span>
                          <span className="text-sm text-gray-600">
                            {latestCoverage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Mini trend line */}
                      <div className="h-8 bg-white rounded flex items-end space-x-1 p-1">
                        {typeData.slice(-10).map((point, index) => { // Last 10 points
                          const height = Math.max(2, (point.coverage_percentage / 100) * 20)
                          return (
                            <div
                              key={index}
                              className="bg-blue-400 rounded-sm flex-1 transition-all"
                              style={{ height: `${height}px` }}
                              title={`${new Date(point.date).toLocaleDateString()}: ${point.coverage_percentage.toFixed(1)}%`}
                            ></div>
                          )
                        })}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {typeData.length} data points over {Math.ceil((new Date(typeData[typeData.length - 1].date).getTime() - new Date(typeData[0].date).getTime()) / (1000 * 60 * 60 * 24))} days
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}