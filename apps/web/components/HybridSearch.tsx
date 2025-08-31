'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Search, 
  Clock, 
  FileText, 
  BookOpen, 
  Star,
  Filter,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { createApiClient } from '@/lib/api'

interface SearchResult {
  id: string
  source?: string
  title?: string
  section?: string
  text: string
  highlights?: string[]
  score?: number
  type: 'regulation' | 'document'
  path?: string
}

interface HybridSearchProps {
  onResultSelect?: (result: SearchResult) => void
  embedded?: boolean
  autoFocus?: boolean
  placeholder?: string
}

export default function HybridSearch({ 
  onResultSelect, 
  embedded = false,
  autoFocus = false,
  placeholder = "Search regulations and documents..."
}: HybridSearchProps) {
  const { token } = useAuth()
  const api = React.useMemo(() => createApiClient(token), [token])
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recent_searches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to load recent searches')
      }
    }
  }, [])

  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    // Handle clicks outside dropdown
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setError(null)
      return
    }

    setIsSearching(true)
    setError(null)
    
    try {
      const response = await api.request('/query/hybrid', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery })
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      
      // Transform API response to our format
      const transformedResults: SearchResult[] = [
        ...(data.regs || []).map((reg: any) => ({
          id: `reg-${reg.id}`,
          type: 'regulation' as const,
          source: reg.source,
          title: reg.title || reg.section,
          section: reg.section,
          text: reg.text,
          highlights: data.highlights || [],
          score: reg.fts_score
        })),
        ...(data.docs || []).map((doc: any, index: number) => ({
          id: `doc-${doc.path}-${index}`,
          type: 'document' as const,
          path: doc.path,
          title: doc.path.split('/').pop() || doc.path,
          text: doc.content,
          highlights: data.highlights || [],
          score: doc.sim_score
        }))
      ]

      setResults(transformedResults)
      setSelectedIndex(-1)
      
      // Save to recent searches
      saveRecentSearch(searchQuery)
      
    } catch (e) {
      console.error('Search error:', e)
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const saveRecentSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recent_searches', JSON.stringify(updated))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Debounce search
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
    
    setShowDropdown(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > -1 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        } else if (query.trim()) {
          performSearch(query)
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleResultClick = (result: SearchResult) => {
    setShowDropdown(false)
    setSelectedIndex(-1)
    
    if (onResultSelect) {
      onResultSelect(result)
    }
  }

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery)
    performSearch(recentQuery)
    setShowDropdown(false)
  }

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights.length) return text

    let highlightedText = text
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })
    
    return highlightedText
  }

  const getResultIcon = (result: SearchResult) => {
    return result.type === 'regulation' ? (
      <BookOpen className="h-4 w-4 text-blue-600" />
    ) : (
      <FileText className="h-4 w-4 text-green-600" />
    )
  }

  const getResultBadge = (result: SearchResult) => {
    return result.type === 'regulation' ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Regulation
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Document
      </span>
    )
  }

  const containerClasses = embedded 
    ? "" 
    : "max-w-2xl mx-auto"

  const inputClasses = `
    w-full px-4 py-3 pl-12 pr-4 text-lg border border-gray-300 rounded-lg 
    focus:ring-2 focus:ring-blue-500 focus:border-transparent
    placeholder-gray-500 transition-all duration-200
    ${embedded ? 'text-sm py-2' : ''}
  `

  return (
    <div className={`relative ${containerClasses}`} ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 ${embedded ? 'h-4 w-4' : 'h-6 w-6'}`} />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className={inputClasses}
        />
        
        {isSearching && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Search Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {/* Error State */}
          {error && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 font-medium">Recent Searches</span>
              </div>
              {recentSearches.map((recent, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(recent)}
                  className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                  {recent}
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="p-2">
              <div className="flex items-center space-x-2 mb-2 px-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600 font-medium">
                  {results.length} result{results.length === 1 ? '' : 's'} found
                </span>
              </div>
              
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    index === selectedIndex 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getResultIcon(result)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        {getResultBadge(result)}
                        {result.score && (
                          <span className="text-xs text-gray-500">
                            {Math.round(result.score * 100)}% match
                          </span>
                        )}
                      </div>
                      
                      {result.source && (
                        <p className="text-xs text-gray-600 mb-1">
                          {result.source} {result.section && `• ${result.section}`}
                        </p>
                      )}
                      
                      <p 
                        className="text-sm text-gray-700 line-clamp-2"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightText(
                            result.text.length > 150 
                              ? result.text.substring(0, 150) + '...' 
                              : result.text,
                            result.highlights || []
                          )
                        }}
                      />
                    </div>
                    
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-2" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query && !isSearching && results.length === 0 && !error && (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No results found</h3>
              <p className="text-sm text-gray-600">
                Try adjusting your search terms or check for typos
              </p>
            </div>
          )}

          {/* Search Tips */}
          {!query && recentSearches.length === 0 && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Search Tips</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Use specific terms like "GDPR data retention"</li>
                <li>• Search for regulation names or document titles</li>
                <li>• Use quotes for exact phrases</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}