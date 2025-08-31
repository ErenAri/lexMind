'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  GitBranch, 
  Eye, 
  Download, 
  RestoreIcon,
  FileText,
  ChevronDown,
  ChevronRight,
  Calendar,
  Hash
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

export interface DocumentVersion {
  version_id: string;
  document_id: string;
  version_number: number;
  title: string;
  content?: string;
  metadata: {
    author: string;
    created_at: string;
    file_size: number;
    change_summary?: string;
    tags?: string[];
  };
  is_current: boolean;
  parent_version_id?: string;
}

interface DocumentVersionHistoryProps {
  documentId: string;
  currentVersion?: string;
  onVersionRestore?: (versionId: string) => void;
  onVersionView?: (versionId: string) => void;
}

export default function DocumentVersionHistory({ 
  documentId, 
  currentVersion,
  onVersionRestore,
  onVersionView 
}: DocumentVersionHistoryProps) {
  const { token } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadVersionHistory();
  }, [documentId]);

  const loadVersionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.request(`/api/v1/documents/${documentId}/versions`);
      if (!response.ok) {
        throw new Error(`Failed to load version history: ${response.status}`);
      }
      
      const data = await response.json();
      setVersions(data.versions || []);
      
      // Auto-expand current version
      if (currentVersion) {
        setExpandedVersions(new Set([currentVersion]));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load version history');
      console.error('Version history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionRestore = async (versionId: string) => {
    if (!onVersionRestore) return;
    
    try {
      setRestoring(versionId);
      await onVersionRestore(versionId);
      await loadVersionHistory(); // Refresh after restore
    } catch (err) {
      console.error('Version restore error:', err);
    } finally {
      setRestoring(null);
    }
  };

  const toggleVersionExpand = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getVersionBadgeColor = (version: DocumentVersion) => {
    if (version.is_current) return 'bg-green-100 text-green-800 border-green-200';
    if (version.version_id === currentVersion) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getTimeDifference = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-5 w-5 text-gray-400 animate-pulse" />
          <h3 className="font-semibold text-gray-900">Version History</h3>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-5 w-5 text-red-600" />
          <h3 className="font-semibold text-gray-900">Version History</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Version History</h3>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              {versions.length} versions
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {versions.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Version History</h4>
            <p className="text-gray-600">This document doesn't have any previous versions.</p>
          </div>
        ) : (
          versions.map((version, index) => {
            const isExpanded = expandedVersions.has(version.version_id);
            const isRestoring = restoring === version.version_id;
            
            return (
              <div key={version.version_id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <button
                        onClick={() => toggleVersionExpand(version.version_id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      
                      <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getVersionBadgeColor(version)}`}>
                        v{version.version_number}
                        {version.is_current && ' (Current)'}
                      </div>
                      
                      <h4 className="font-medium text-gray-900">{version.title}</h4>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600 ml-8">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{version.metadata.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{getTimeDifference(version.metadata.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="h-4 w-4" />
                        <span>{formatFileSize(version.metadata.file_size)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Hash className="h-4 w-4" />
                        <span className="font-mono text-xs">{version.version_id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {version.metadata.change_summary && (
                      <div className="ml-8 mt-2">
                        <p className="text-sm text-gray-700 italic">
                          "{version.metadata.change_summary}"
                        </p>
                      </div>
                    )}

                    {version.metadata.tags && version.metadata.tags.length > 0 && (
                      <div className="ml-8 mt-2 flex items-center space-x-2">
                        {version.metadata.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="ml-8 mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Created:</span>
                            <p className="text-gray-600">{new Date(version.metadata.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Author:</span>
                            <p className="text-gray-600">{version.metadata.author}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">File Size:</span>
                            <p className="text-gray-600">{formatFileSize(version.metadata.file_size)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Version ID:</span>
                            <p className="text-gray-600 font-mono text-xs">{version.version_id}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {onVersionView && (
                      <button
                        onClick={() => onVersionView(version.version_id)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View this version"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download this version"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    
                    {!version.is_current && onVersionRestore && (
                      <button
                        onClick={() => handleVersionRestore(version.version_id)}
                        disabled={isRestoring}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Restore this version"
                      >
                        {isRestoring ? (
                          <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RestoreIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}