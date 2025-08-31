'use client'

import React, { useState, useEffect } from 'react'
// import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard'
// import { RealTimeMetrics } from '../../components/dashboard/RealTimeMetrics'
// import { ComplianceHeatMap } from '../../components/dashboard/ComplianceHeatMap'
// TODO: Re-enable once backend analytics endpoints are implemented

export default function MobileDashboard() {
  const [activeView, setActiveView] = useState<'overview' | 'heatmap' | 'metrics' | 'alerts'>('overview')
  const [isOnline, setIsOnline] = useState(true)

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const views = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'heatmap', label: 'Risks', icon: '🔥' },
    { key: 'metrics', label: 'Live', icon: '⚡' },
    { key: 'alerts', label: 'Alerts', icon: '🚨' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Mobile Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                LexMind Mobile
              </h1>
              <p className="text-xs text-gray-500">Executive Compliance</p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-600">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="flex border-t border-gray-100">
          {views.map((view) => (
            <button
              key={view.key}
              onClick={() => setActiveView(view.key as any)}
              className={`flex-1 py-3 px-2 text-center transition-colors ${
                activeView === view.key
                  ? 'bg-blue-50 text-blue-700 border-t-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-lg">{view.icon}</div>
              <div className="text-xs font-medium mt-1">{view.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Content */}
      <div className="p-4">
        {activeView === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20">
              <h2 className="font-semibold text-gray-900 mb-3">Quick Stats</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">87%</div>
                  <div className="text-xs text-gray-600">Compliance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">3</div>
                  <div className="text-xs text-gray-600">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">95%</div>
                  <div className="text-xs text-gray-600">Performance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">12</div>
                  <div className="text-xs text-gray-600">Active Users</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Activity</h2>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">New risk assessment completed</span>
                  <span className="text-xs text-gray-500 ml-auto">2m ago</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Policy document updated</span>
                  <span className="text-xs text-gray-500 ml-auto">5m ago</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Collaboration session started</span>
                  <span className="text-xs text-gray-500 ml-auto">8m ago</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20">
              <h2 className="font-semibold text-gray-900 mb-3">Action Items</h2>
              <div className="space-y-2">
                <div className="border-l-4 border-red-500 pl-3 py-2">
                  <div className="text-sm font-medium text-red-800">Critical: Review Dodd-Frank compliance</div>
                  <div className="text-xs text-red-600">Due today</div>
                </div>
                <div className="border-l-4 border-yellow-500 pl-3 py-2">
                  <div className="text-sm font-medium text-yellow-800">Update risk assessment procedures</div>
                  <div className="text-xs text-yellow-600">Due in 3 days</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'heatmap' && (
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Risk Heat Map</h2>
              <p className="text-sm text-gray-600">Touch cells for details</p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-gray-400 mb-2">🔧</div>
                  <p className="text-sm text-gray-600">Compliance Heatmap</p>
                  <p className="text-xs text-gray-500">Feature under development</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'metrics' && (
          <div className="space-y-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Live Metrics</h2>
                <p className="text-sm text-gray-600">Real-time system status</p>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-gray-400 mb-2">⚡</div>
                    <p className="text-sm text-gray-600">Real-time Metrics</p>
                    <p className="text-xs text-gray-500">Feature under development</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20">
              <h2 className="font-semibold text-gray-900 mb-3">🚨 Critical Alerts</h2>
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div className="text-red-600">🔴</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-800">High Risk: Volcker Rule Compliance</div>
                      <div className="text-xs text-red-600 mt-1">Trading policy may violate proprietary trading restrictions</div>
                      <div className="text-xs text-gray-500 mt-2">Goldman Sachs • 10 minutes ago</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div className="text-yellow-600">🟡</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-800">Medium Risk: Basel III Capital</div>
                      <div className="text-xs text-yellow-600 mt-1">Capital adequacy ratios approaching minimum thresholds</div>
                      <div className="text-xs text-gray-500 mt-2">Risk Management • 2 hours ago</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div className="text-blue-600">ℹ️</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-800">Info: System Performance</div>
                      <div className="text-xs text-blue-600 mt-1">Query performance excellent: 45ms average latency</div>
                      <div className="text-xs text-gray-500 mt-2">TiDB Serverless • 5 minutes ago</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20">
              <h2 className="font-semibold text-gray-900 mb-3">📊 System Health</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Database</span>
                  <span className="text-sm text-green-600">✅ Healthy</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">TiFlash</span>
                  <span className="text-sm text-green-600">✅ Active</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Vector Search</span>
                  <span className="text-sm text-green-600">✅ Optimal</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Collaboration</span>
                  <span className="text-sm text-blue-600">🔵 12 Users Online</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Footer */}
      <div className="h-20"></div> {/* Spacing for mobile navigation */}
    </div>
  )
}