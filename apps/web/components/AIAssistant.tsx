'use client'

import React, { useState } from 'react'
import { 
  Sparkles, 
  FileText, 
  BookOpen, 
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Bot,
  Send,
  Loader2,
  X,
  Copy,
  Download,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createApiClient } from '@/lib/api'

interface AIExplanation {
  summary: string
  risks: Array<{
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    impact: string
  }>
  recommendations: string[]
}

interface AIFixItPlan {
  actions: Array<{
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    owner: string
    timeline: string
    effort: string
  }>
  notes: string
  estimated_completion: string
}

interface AIAssistantProps {
  regulationText?: string
  documentText?: string
  embedded?: boolean
  onClose?: () => void
}

export default function AIAssistant({ 
  regulationText, 
  documentText, 
  embedded = false,
  onClose 
}: AIAssistantProps) {
  const { token } = useAuth()
  const api = React.useMemo(() => createApiClient(token), [token])
  
  const [mode, setMode] = useState<'explain' | 'fix-it'>('explain')
  const [isLoading, setIsLoading] = useState(false)
  const [explanation, setExplanation] = useState<AIExplanation | null>(null)
  const [fixItPlan, setFixItPlan] = useState<AIFixItPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [customRegText, setCustomRegText] = useState(regulationText || '')
  const [customDocText, setCustomDocText] = useState(documentText || '')

  const getExplanation = async () => {
    if (!customRegText.trim() || !customDocText.trim()) {
      setError('Both regulation and document text are required for explanation')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await api.request('/ai/explain', {
        method: 'POST',
        body: JSON.stringify({
          regulation_text: customRegText,
          document_text: customDocText
        })
      })

      if (!response.ok) {
        throw new Error(`AI explanation failed: ${response.status}`)
      }

      const data = await response.json()
      setExplanation({
        summary: data.summary || 'No summary provided',
        risks: data.risks || [],
        recommendations: data.recommendations || []
      })
    } catch (e) {
      console.error('AI explanation error:', e)
      setError(e instanceof Error ? e.message : 'Failed to get AI explanation')
    } finally {
      setIsLoading(false)
    }
  }

  const getFixItPlan = async () => {
    if (!customRegText.trim() || !customDocText.trim()) {
      setError('Both regulation and document text are required for fix-it plan')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await api.request('/ai/fix-it', {
        method: 'POST',
        body: JSON.stringify({
          regulation_text: customRegText,
          document_text: customDocText
        })
      })

      if (!response.ok) {
        throw new Error(`AI fix-it failed: ${response.status}`)
      }

      const data = await response.json()
      setFixItPlan({
        actions: data.actions || [],
        notes: data.notes || '',
        estimated_completion: data.estimated_completion || 'Unknown'
      })
    } catch (e) {
      console.error('AI fix-it error:', e)
      setError(e instanceof Error ? e.message : 'Failed to get fix-it plan')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (mode === 'explain') {
      await getExplanation()
    } else {
      await getFixItPlan()
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'border-green-300 bg-green-50'
      case 'medium': return 'border-yellow-300 bg-yellow-50'
      case 'high': return 'border-orange-300 bg-orange-50'
      case 'critical': return 'border-red-300 bg-red-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const exportResults = () => {
    const data = mode === 'explain' ? explanation : fixItPlan
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-${mode}-results.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      console.log('Copied to clipboard')
    }).catch(err => {
      console.error('Failed to copy to clipboard', err)
    })
  }

  const containerClasses = embedded 
    ? "bg-white rounded-lg border border-gray-200 p-6"
    : "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"

  const contentClasses = embedded 
    ? ""
    : "bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"

  return (
    <div className={containerClasses}>
      <div className={contentClasses}>
        {!embedded && (
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Compliance Assistant</h2>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        <div className={embedded ? "" : "p-6"}>
          {/* Mode Selection */}
          <div className="flex items-center space-x-1 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setMode('explain')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'explain'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Lightbulb className="h-4 w-4" />
              <span>Explain Compliance</span>
            </button>
            <button
              onClick={() => setMode('fix-it')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'fix-it'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Fix-It Plan</span>
            </button>
          </div>

          {/* Input Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <BookOpen className="inline h-4 w-4 mr-1" />
                Regulation Text
              </label>
              <textarea
                value={customRegText}
                onChange={(e) => setCustomRegText(e.target.value)}
                placeholder="Paste or type regulation text here..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Document Text
              </label>
              <textarea
                value={customDocText}
                onChange={(e) => setCustomDocText(e.target.value)}
                placeholder="Paste or type document text here..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSubmit}
                disabled={isLoading || !customRegText.trim() || !customDocText.trim()}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                <span>
                  {isLoading 
                    ? 'Analyzing...' 
                    : mode === 'explain' 
                      ? 'Get Explanation' 
                      : 'Generate Fix-It Plan'
                  }
                </span>
              </button>
              
              <button
                onClick={() => {
                  setExplanation(null)
                  setFixItPlan(null)
                  setError(null)
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {(explanation || fixItPlan) && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(mode === 'explain' ? explanation : fixItPlan, null, 2))}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={exportResults}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-red-700 font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}

          {/* Explanation Results */}
          {mode === 'explain' && explanation && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">AI Explanation</h3>
                </div>
                <p className="text-blue-800 leading-relaxed">{explanation.summary}</p>
              </div>

              {explanation.risks.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Identified Risks</h3>
                  </div>
                  <div className="space-y-4">
                    {explanation.risks.map((risk, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{risk.description}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(risk.severity)}`}>
                            {risk.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{risk.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.recommendations.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-900">Recommendations</h3>
                  </div>
                  <ul className="space-y-2">
                    {explanation.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                        <span className="text-green-800">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Fix-It Plan Results */}
          {mode === 'fix-it' && fixItPlan && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-3">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">AI-Generated Fix-It Plan</h3>
                </div>
                {fixItPlan.notes && (
                  <p className="text-blue-800 leading-relaxed mb-3">{fixItPlan.notes}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-blue-700">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Est. Completion: {fixItPlan.estimated_completion}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>{fixItPlan.actions.length} Action Items</span>
                  </div>
                </div>
              </div>

              {fixItPlan.actions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span>Action Items</span>
                  </h3>
                  {fixItPlan.actions.map((action, index) => (
                    <div 
                      key={index} 
                      className={`border-l-4 rounded-lg p-4 ${getPriorityColor(action.priority)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{action.title}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(action.priority)}`}>
                            {action.priority.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">{action.timeline}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{action.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Owner: {action.owner}</span>
                        <span>Effort: {action.effort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}