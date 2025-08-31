'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';
import { 
  Search,
  Filter,
  Calendar,
  Tag,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  Settings,
  Download,
  Eye,
  BookOpen
} from 'lucide-react';

interface SearchFilters {
  query: string;
  documentTypes: string[];
  complianceStatus: string[];
  riskLevels: string[];
  frameworks: string[];
  dateRange: {
    start: string;
    end: string;
  };
  tags: string[];
  minScore: number;
  maxScore: number;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'regulation' | 'document' | 'policy';
  path: string;
  score: number;
  complianceStatus: 'compliant' | 'non_compliant' | 'partially_compliant' | 'pending';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  framework: string;
  lastAnalyzed: string;
  highlights: string[];
  tags: string[];
  excerpt: string;
  metadata: {
    size: string;
    pages?: number;
    author?: string;
    version?: string;
  };
}

export default function AdvancedSearch() {
  const { user, token } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    documentTypes: [],
    complianceStatus: [],
    riskLevels: [],
    frameworks: [],
    dateRange: { start: '', end: '' },
    tags: [],
    minScore: 0,
    maxScore: 100
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'score' | 'title'>('relevance');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const documentTypes = [
    { id: 'regulation', label: 'Regulations', icon: BookOpen },
    { id: 'policy', label: 'Policies', icon: FileText },
    { id: 'procedure', label: 'Procedures', icon: Settings },
    { id: 'contract', label: 'Contracts', icon: FileText },
    { id: 'audit', label: 'Audit Reports', icon: Shield },
  ];

  const complianceStatuses = [
    { id: 'compliant', label: 'Compliant', icon: CheckCircle, color: 'text-success-600' },
    { id: 'partially_compliant', label: 'Partially Compliant', icon: Clock, color: 'text-warning-600' },
    { id: 'non_compliant', label: 'Non-Compliant', icon: AlertTriangle, color: 'text-danger-600' },
    { id: 'pending', label: 'Pending Review', icon: Clock, color: 'text-secondary-600' },
  ];

  const riskLevels = [
    { id: 'low', label: 'Low Risk', color: 'bg-success-100 text-success-800' },
    { id: 'medium', label: 'Medium Risk', color: 'bg-warning-100 text-warning-800' },
    { id: 'high', label: 'High Risk', color: 'bg-danger-100 text-danger-800' },
    { id: 'critical', label: 'Critical Risk', color: 'bg-red-100 text-red-800' },
  ];

  const frameworks = [
    'GDPR', 'SOX', 'HIPAA', 'ISO27001', 'PCI DSS', 'NIST', 'CCPA', 'SOC2'
  ];

  const availableTags = [
    'encryption', 'access-control', 'data-retention', 'incident-response',
    'risk-assessment', 'audit', 'training', 'privacy', 'security', 'governance'
  ];

  // Real API search function
  const performSearch = async () => {
    if (!filters.query.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await api.request('/query/hybrid', {
        method: 'POST',
        body: JSON.stringify({ query: filters.query })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API response to our format
      const transformedResults: SearchResult[] = [
        ...(data.regs || []).map((reg: any) => ({
          id: `reg-${reg.id}`,
          title: reg.title || reg.section || 'Untitled Regulation',
          type: 'regulation' as const,
          path: `reg:${reg.id}`,
          score: Math.round((reg.fts_score || 0) * 100),
          complianceStatus: 'pending' as const, // Default since API doesn't provide this
          riskLevel: 'medium' as const, // Default since API doesn't provide this
          framework: reg.source || 'Unknown',
          lastAnalyzed: new Date().toISOString().split('T')[0],
          highlights: data.highlights || [],
          tags: [], // Could extract from text analysis
          excerpt: reg.text?.substring(0, 200) + '...' || '',
          metadata: {
            size: Math.round(reg.text?.length / 1024 || 0) + ' KB',
            author: 'Regulatory Authority',
            version: '1.0'
          }
        })),
        ...(data.docs || []).map((doc: any, index: number) => ({
          id: `doc-${doc.path}-${index}`,
          title: doc.path?.split('/').pop() || doc.path || 'Untitled Document',
          type: 'document' as const,
          path: doc.path,
          score: Math.round((doc.sim_score || 0) * 100),
          complianceStatus: 'pending' as const,
          riskLevel: 'medium' as const,
          framework: 'Unknown',
          lastAnalyzed: new Date().toISOString().split('T')[0],
          highlights: data.highlights || [],
          tags: [],
          excerpt: doc.content?.substring(0, 200) + '...' || '',
          metadata: {
            size: Math.round(doc.content?.length / 1024 || 0) + ' KB',
            author: 'Unknown',
            version: '1.0'
          }
        }))
      ];

      // Apply local filters
      let filteredResults = transformedResults;

      if (filters.complianceStatus.length > 0) {
        filteredResults = filteredResults.filter(result => 
          filters.complianceStatus.includes(result.complianceStatus)
        );
      }

      if (filters.riskLevels.length > 0) {
        filteredResults = filteredResults.filter(result => 
          filters.riskLevels.includes(result.riskLevel)
        );
      }

      if (filters.frameworks.length > 0) {
        filteredResults = filteredResults.filter(result => 
          filters.frameworks.some(f => 
            result.framework.toLowerCase().includes(f.toLowerCase())
          )
        );
      }

      if (filters.documentTypes.length > 0) {
        filteredResults = filteredResults.filter(result => 
          filters.documentTypes.includes(result.type)
        );
      }

      // Apply score range filter
      filteredResults = filteredResults.filter(result => 
        result.score >= filters.minScore && result.score <= filters.maxScore
      );

      // Sort results
      filteredResults.sort((a, b) => {
        switch (sortBy) {
          case 'score':
            return b.score - a.score;
          case 'date':
            return new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime();
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return b.score - a.score; // Default to relevance (score)
        }
      });

      setResults(filteredResults);
      
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to empty results on error
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).includes(value)
        ? (prev[key] as string[]).filter(item => item !== value)
        : [...(prev[key] as string[]), value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      documentTypes: [],
      complianceStatus: [],
      riskLevels: [],
      frameworks: [],
      dateRange: { start: '', end: '' },
      tags: [],
      minScore: 0,
      maxScore: 100
    });
    setResults([]);
  };

  const saveSearch = () => {
    const searchName = `Search: ${filters.query || 'All documents'}`;
    setSavedSearches(prev => [...prev, searchName]);
  };

  const getStatusIcon = (status: string) => {
    const statusObj = complianceStatuses.find(s => s.id === status);
    if (!statusObj) return Clock;
    return statusObj.icon;
  };

  const getStatusColor = (status: string) => {
    const statusObj = complianceStatuses.find(s => s.id === status);
    return statusObj?.color || 'text-secondary-600';
  };

  const getRiskColor = (risk: string) => {
    const riskObj = riskLevels.find(r => r.id === risk);
    return riskObj?.color || 'bg-secondary-100 text-secondary-800';
  };

  const viewDocument = async (result: SearchResult) => {
    try {
      if (result.type === 'regulation') {
        // Open regulation in new tab or modal
        const regId = result.id.replace('reg-', '');
        window.open(`/documents?reg=${regId}`, '_blank');
      } else {
        // Open document in new tab or modal  
        window.open(`/documents?doc=${encodeURIComponent(result.path)}`, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
    }
  };

  const downloadDocument = async (result: SearchResult) => {
    try {
      const response = await api.request(`/documents/${encodeURIComponent(result.path)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.content || '';
      
      // Create download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.title}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  useEffect(() => {
    if (filters.query || filters.complianceStatus.length || filters.riskLevels.length || filters.frameworks.length) {
      performSearch();
    }
  }, [filters, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <Search className="h-8 w-8 text-primary-600" />
            Advanced Search
          </h2>
          <p className="text-secondary-600">Find documents with powerful filters and faceted search</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-md`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button onClick={saveSearch} className="btn btn-secondary btn-md">
            Save Search
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search documents, regulations, policies..."
              value={filters.query}
              onChange={(e) => handleFilterChange('query', e.target.value)}
              className="input pl-10 w-full"
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            />
          </div>
          <button
            onClick={performSearch}
            disabled={isSearching}
            className="btn btn-primary px-8"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-secondary-900">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-danger-600 hover:text-danger-700"
                >
                  Clear All
                </button>
              </div>

              {/* Document Types */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Document Types</h4>
                <div className="space-y-2">
                  {documentTypes.map((type) => (
                    <label key={type.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.documentTypes.includes(type.id)}
                        onChange={() => toggleFilter('documentTypes', type.id)}
                        className="rounded"
                      />
                      <type.icon className="h-4 w-4 text-secondary-600" />
                      <span className="text-sm text-secondary-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Compliance Status */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Compliance Status</h4>
                <div className="space-y-2">
                  {complianceStatuses.map((status) => (
                    <label key={status.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.complianceStatus.includes(status.id)}
                        onChange={() => toggleFilter('complianceStatus', status.id)}
                        className="rounded"
                      />
                      <status.icon className={`h-4 w-4 ${status.color}`} />
                      <span className="text-sm text-secondary-700">{status.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Risk Levels */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Risk Levels</h4>
                <div className="space-y-2">
                  {riskLevels.map((risk) => (
                    <label key={risk.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.riskLevels.includes(risk.id)}
                        onChange={() => toggleFilter('riskLevels', risk.id)}
                        className="rounded"
                      />
                      <span className={`text-xs px-2 py-1 rounded-full ${risk.color}`}>
                        {risk.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Frameworks */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Frameworks</h4>
                <div className="space-y-2">
                  {frameworks.map((framework) => (
                    <label key={framework} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.frameworks.includes(framework)}
                        onChange={() => toggleFilter('frameworks', framework)}
                        className="rounded"
                      />
                      <span className="text-sm text-secondary-700">{framework}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Score Range */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Compliance Score</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-secondary-600">Min Score: {filters.minScore}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.minScore}
                      onChange={(e) => handleFilterChange('minScore', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-secondary-600">Max Score: {filters.maxScore}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.maxScore}
                      onChange={(e) => handleFilterChange('maxScore', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <h4 className="font-medium text-secondary-700 mb-3">Date Range</h4>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, start: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, end: e.target.value })}
                    className="input w-full text-sm"
                    placeholder="End date"
                  />
                </div>
              </div>
            </div>

            {/* Saved Searches */}
            {savedSearches.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold text-secondary-900 mb-4">Saved Searches</h3>
                <div className="space-y-2">
                  {savedSearches.map((search, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-secondary-50 rounded">
                      <span className="text-sm text-secondary-700">{search}</span>
                      <button className="text-danger-600 hover:text-danger-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-secondary-600">
                {results.length} results found
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input text-sm"
              >
                <option value="relevance">Sort by Relevance</option>
                <option value="score">Sort by Score</option>
                <option value="date">Sort by Date</option>
                <option value="title">Sort by Title</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-secondary-600">Searching documents...</p>
              </div>
            </div>
          )}

          {/* Results List */}
          {!isSearching && results.length > 0 && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
              {results.map((result) => {
                const StatusIcon = getStatusIcon(result.complianceStatus);
                return (
                  <div key={result.id} className="card p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-secondary-900 mb-1">{result.title}</h3>
                        <p className="text-sm text-secondary-600 mb-2">{result.path}</p>
                        <p className="text-sm text-secondary-700">{result.excerpt}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-primary-600 mb-1">{result.score}%</div>
                        <div className="text-xs text-secondary-500">Score</div>
                      </div>
                    </div>

                    {/* Highlights */}
                    {result.highlights.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {result.highlights.map((highlight, index) => (
                            <span key={index} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status and Risk */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`h-4 w-4 ${getStatusColor(result.complianceStatus)}`} />
                        <span className="text-xs text-secondary-600 capitalize">
                          {result.complianceStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor(result.riskLevel)}`}>
                        {result.riskLevel.toUpperCase()} RISK
                      </span>
                      <span className="text-xs text-secondary-600">{result.framework}</span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {result.tags.map((tag, index) => (
                        <span key={index} className="bg-secondary-100 text-secondary-700 text-xs px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Metadata and Actions */}
                    <div className="flex items-center justify-between text-xs text-secondary-500">
                      <div className="flex items-center gap-4">
                        <span>{result.metadata.size}</span>
                        {result.metadata.pages && <span>{result.metadata.pages} pages</span>}
                        <span>Last analyzed: {new Date(result.lastAnalyzed).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => viewDocument(result)}
                          className="btn btn-ghost btn-xs hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                        <button 
                          onClick={() => downloadDocument(result)}
                          className="btn btn-ghost btn-xs hover:bg-green-50 hover:text-green-700"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {!isSearching && results.length === 0 && filters.query && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No results found</h3>
              <p className="text-secondary-600">Try adjusting your search terms or filters</p>
            </div>
          )}

          {/* Initial State */}
          {!isSearching && results.length === 0 && !filters.query && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">Start searching</h3>
              <p className="text-secondary-600">Enter keywords or use filters to find documents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}