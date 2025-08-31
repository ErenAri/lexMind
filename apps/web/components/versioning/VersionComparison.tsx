'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  Plus, 
  Minus, 
  RotateCcw,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';
import { DocumentVersion } from './DocumentVersionHistory';

interface VersionComparisonProps {
  documentId: string;
  leftVersionId: string;
  rightVersionId: string;
  onClose?: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  leftContent?: string;
  rightContent?: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

interface ComparisonData {
  leftVersion: DocumentVersion;
  rightVersion: DocumentVersion;
  diff: DiffLine[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

export default function VersionComparison({ 
  documentId, 
  leftVersionId, 
  rightVersionId,
  onClose 
}: VersionComparisonProps) {
  const { token } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadComparison();
  }, [documentId, leftVersionId, rightVersionId]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.request(`/api/v1/documents/${documentId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          left_version: leftVersionId,
          right_version: rightVersionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to compare versions: ${response.status}`);
      }
      
      const data = await response.json();
      setComparison(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compare versions');
      console.error('Version comparison error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionIndex: number) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionIndex)) {
      newCollapsed.delete(sectionIndex);
    } else {
      newCollapsed.add(sectionIndex);
    }
    setCollapsedSections(newCollapsed);
  };

  const getLineBackgroundColor = (type: string) => {
    switch (type) {
      case 'added': return 'bg-green-50 border-green-200';
      case 'removed': return 'bg-red-50 border-red-200';
      case 'modified': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-white border-gray-200';
    }
  };

  const getLineTextColor = (type: string) => {
    switch (type) {
      case 'added': return 'text-green-800';
      case 'removed': return 'text-red-800';
      case 'modified': return 'text-yellow-800';
      default: return 'text-gray-800';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="h-3 w-3 text-green-600" />;
      case 'removed': return <Minus className="h-3 w-3 text-red-600" />;
      case 'modified': return <RotateCcw className="h-3 w-3 text-yellow-600" />;
      default: return null;
    }
  };

  const filteredDiff = showUnchanged 
    ? comparison?.diff || [] 
    : comparison?.diff.filter(line => line.type !== 'unchanged') || [];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900">Comparing Versions</h3>
            <p className="text-gray-600">Analyzing differences between document versions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Comparison Failed</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-screen flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GitBranch className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Version Comparison</h2>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'side-by-side' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Side by Side
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'unified' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Unified
                </button>
              </div>
              
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Version Info */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div>
                  <span className="font-medium text-gray-900">v{comparison.leftVersion.version_number}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {new Date(comparison.leftVersion.metadata.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <span className="font-medium text-gray-900">v{comparison.rightVersion.version_number}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {new Date(comparison.rightVersion.metadata.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Stats */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1 text-green-700">
                <Plus className="h-4 w-4" />
                <span>{comparison.stats.additions} additions</span>
              </div>
              <div className="flex items-center space-x-1 text-red-700">
                <Minus className="h-4 w-4" />
                <span>{comparison.stats.deletions} deletions</span>
              </div>
              <div className="flex items-center space-x-1 text-yellow-700">
                <RotateCcw className="h-4 w-4" />
                <span>{comparison.stats.modifications} modifications</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Show unchanged lines</span>
            </label>
            
            <div className="text-sm text-gray-600">
              Showing {filteredDiff.length} of {comparison.diff.length} lines
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 h-full">
              {/* Left Version */}
              <div className="border-r border-gray-200 bg-red-50/30">
                <div className="sticky top-0 bg-red-100 border-b border-red-200 px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-900">
                      v{comparison.leftVersion.version_number} ({comparison.leftVersion.metadata.author})
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {filteredDiff.map((line, index) => (
                    line.leftContent !== undefined && (
                      <div
                        key={index}
                        className={`flex items-start space-x-2 px-2 py-1 font-mono text-sm border-l-4 ${
                          line.type === 'removed' ? 'border-red-400 bg-red-50' :
                          line.type === 'modified' ? 'border-yellow-400 bg-yellow-50' :
                          'border-transparent'
                        }`}
                      >
                        <span className="w-8 text-gray-500 text-right flex-shrink-0">
                          {line.leftLineNumber}
                        </span>
                        <span className="flex-1">{line.leftContent}</span>
                        {getChangeIcon(line.type)}
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Right Version */}
              <div className="bg-green-50/30">
                <div className="sticky top-0 bg-green-100 border-b border-green-200 px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">
                      v{comparison.rightVersion.version_number} ({comparison.rightVersion.metadata.author})
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {filteredDiff.map((line, index) => (
                    line.rightContent !== undefined && (
                      <div
                        key={index}
                        className={`flex items-start space-x-2 px-2 py-1 font-mono text-sm border-l-4 ${
                          line.type === 'added' ? 'border-green-400 bg-green-50' :
                          line.type === 'modified' ? 'border-yellow-400 bg-yellow-50' :
                          'border-transparent'
                        }`}
                      >
                        <span className="w-8 text-gray-500 text-right flex-shrink-0">
                          {line.rightLineNumber}
                        </span>
                        <span className="flex-1">{line.rightContent}</span>
                        {getChangeIcon(line.type)}
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Unified View */
            <div className="p-4">
              {filteredDiff.map((line, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-2 px-2 py-1 font-mono text-sm border-l-4 ${getLineBackgroundColor(line.type)} ${getLineTextColor(line.type)}`}
                >
                  <div className="flex space-x-2 w-16 flex-shrink-0 text-gray-500">
                    <span className="w-6 text-right">
                      {line.leftLineNumber || ''}
                    </span>
                    <span className="w-6 text-right">
                      {line.rightLineNumber || ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-1">
                    {getChangeIcon(line.type)}
                    <span>
                      {line.type === 'modified' && line.leftContent !== line.rightContent
                        ? `${line.leftContent} → ${line.rightContent}`
                        : line.rightContent || line.leftContent
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Comparing {comparison.leftVersion.title} versions {comparison.leftVersion.version_number} and {comparison.rightVersion.version_number}
            </div>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="h-4 w-4" />
                <span>Export Diff</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}