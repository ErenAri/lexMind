'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  History,
  GitBranch,
  Compare,
  Undo,
  Plus,
  MessageSquare,
  Tag,
  Clock,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  Download,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  Hash,
  Zap
} from 'lucide-react';

interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  path: string;
  content_hash: string;
  file_size: number;
  mime_type?: string;
  metadata: any;
  upload_type: 'initial' | 'update' | 'revision' | 'rollback';
  uploaded_by: string;
  upload_reason?: string;
  is_current: boolean;
  is_archived: boolean;
  created_at: string;
  change_count: number;
  tags?: string;
  comment_count: number;
  approval_count: number;
}

interface DocumentChange {
  id: number;
  change_type: 'added' | 'modified' | 'deleted' | 'moved' | 'renamed';
  section_type: string;
  old_content?: string;
  new_content?: string;
  line_start: number;
  line_end: number;
  confidence_score: number;
  change_summary: string;
  impact_assessment: 'low' | 'medium' | 'high' | 'critical';
  compliance_impact: any;
  created_at: string;
  from_version_number: number;
  to_version_number: number;
}

interface VersionComparison {
  version1: {
    number: number;
    content: string;
    created_at: string;
    uploaded_by: string;
  };
  version2: {
    number: number;
    content: string;
    created_at: string;
    uploaded_by: string;
  };
  changes: DocumentChange[];
  statistics: {
    additions: number;
    deletions: number;
    modifications: number;
    total_changes: number;
  };
}

interface DocumentVersioningProps {
  documentId: number;
  documentPath: string;
}

export default function DocumentVersioning({ documentId, documentPath }: DocumentVersioningProps) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [changes, setChanges] = useState<DocumentChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'compare' | 'changes'>('history');
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState('');
  const [newVersionReason, setNewVersionReason] = useState('');

  const uploadTypeColors = {
    initial: 'bg-blue-100 text-blue-800',
    update: 'bg-green-100 text-green-800',
    revision: 'bg-yellow-100 text-yellow-800',
    rollback: 'bg-red-100 text-red-800'
  };

  const changeTypeColors = {
    added: 'bg-green-100 text-green-800',
    modified: 'bg-yellow-100 text-yellow-800',
    deleted: 'bg-red-100 text-red-800',
    moved: 'bg-blue-100 text-blue-800',
    renamed: 'bg-purple-100 text-purple-800'
  };

  const impactColors = {
    low: 'text-success-600',
    medium: 'text-warning-600',
    high: 'text-danger-600',
    critical: 'text-red-600'
  };

  const uploadTypeIcons = {
    initial: FileText,
    update: Edit,
    revision: GitBranch,
    rollback: Undo
  };

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionChanges = async (versionId: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/versions/${versionId}/changes`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChanges(data.changes || []);
        setActiveTab('changes');
      }
    } catch (error) {
      console.error('Failed to load version changes:', error);
    }
  };

  const compareVersions = async (version1: number, version2: number) => {
    setActionLoading('compare');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/versions/compare?version1=${version1}&version2=${version2}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComparison(data);
        setActiveTab('compare');
      }
    } catch (error) {
      console.error('Failed to compare versions:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const createNewVersion = async () => {
    setActionLoading('create');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          content: newVersionContent,
          upload_reason: newVersionReason,
          upload_type: 'update'
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewVersionContent('');
        setNewVersionReason('');
        await loadVersions();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create version');
      }
    } catch (error) {
      console.error('Failed to create version:', error);
      alert('Failed to create version');
    } finally {
      setActionLoading(null);
    }
  };

  const rollbackToVersion = async (versionNumber: number) => {
    const reason = prompt('Please provide a reason for this rollback:');
    if (!reason) return;

    setActionLoading(`rollback-${versionNumber}`);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/versions/${versionNumber}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(reason),
      });

      if (response.ok) {
        await loadVersions();
        alert('Document rolled back successfully');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to rollback');
      }
    } catch (error) {
      console.error('Failed to rollback:', error);
      alert('Failed to rollback version');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVersionSelect = (versionNumber: number) => {
    if (selectedVersions.includes(versionNumber)) {
      setSelectedVersions(selectedVersions.filter(v => v !== versionNumber));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionNumber]);
    } else {
      setSelectedVersions([selectedVersions[1], versionNumber]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUploadTypeIcon = (uploadType: string) => {
    const IconComponent = uploadTypeIcons[uploadType as keyof typeof uploadTypeIcons] || FileText;
    return IconComponent;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <History className="h-8 w-8 text-primary-600" />
            Document Versioning
          </h2>
          <p className="text-secondary-600">{documentPath}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedVersions.length === 2 && (
            <button
              onClick={() => compareVersions(selectedVersions[0], selectedVersions[1])}
              disabled={actionLoading === 'compare'}
              className="btn btn-secondary btn-md"
            >
              <Compare className="h-4 w-4" />
              Compare Selected
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4" />
            New Version
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'history' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <History className="h-4 w-4 inline mr-2" />
          Version History
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          disabled={!comparison}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'compare' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          } ${!comparison ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Compare className="h-4 w-4 inline mr-2" />
          Version Compare
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          disabled={changes.length === 0}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'changes' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          } ${changes.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Zap className="h-4 w-4 inline mr-2" />
          Changes
        </button>
      </div>

      {/* Content */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {versions.map((version) => {
            const UploadIcon = getUploadTypeIcon(version.upload_type);
            const isExpanded = expandedVersion === version.id;
            
            return (
              <div key={version.id} className={`card p-6 ${selectedVersions.includes(version.version_number) ? 'ring-2 ring-primary-500' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedVersions.includes(version.version_number)}
                        onChange={() => handleVersionSelect(version.version_number)}
                        className="rounded"
                      />
                      <div className={`p-2 rounded-lg ${uploadTypeColors[version.upload_type]}`}>
                        <UploadIcon className="h-5 w-5" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-secondary-900">
                          Version {version.version_number}
                        </h3>
                        {version.is_current && (
                          <span className="badge badge-primary">Current</span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${uploadTypeColors[version.upload_type]}`}>
                          {version.upload_type.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-secondary-600">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {version.uploaded_by}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDateTime(version.created_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Hash className="h-4 w-4" />
                            {formatFileSize(version.file_size)}
                          </div>
                        </div>
                        
                        {version.upload_reason && (
                          <p className="text-secondary-700 italic">"{version.upload_reason}"</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs">
                          {version.change_count > 0 && (
                            <span>{version.change_count} changes</span>
                          )}
                          {version.comment_count > 0 && (
                            <span>{version.comment_count} comments</span>
                          )}
                          {version.tags && (
                            <span>Tags: {version.tags}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadVersionChanges(version.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      <Eye className="h-4 w-4" />
                      View Changes
                    </button>
                    
                    {!version.is_current && user?.role === 'admin' && (
                      <button
                        onClick={() => rollbackToVersion(version.version_number)}
                        disabled={actionLoading === `rollback-${version.version_number}`}
                        className="btn btn-danger btn-sm"
                      >
                        <Undo className="h-4 w-4" />
                        Rollback
                      </button>
                    )}
                    
                    <button
                      onClick={() => setExpandedVersion(isExpanded ? null : version.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-secondary-200 pt-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-secondary-900 mb-2">Version Details</h4>
                        <div className="space-y-1">
                          <div>Hash: <code className="text-xs">{version.content_hash.substring(0, 16)}...</code></div>
                          <div>MIME Type: {version.mime_type || 'Unknown'}</div>
                          <div>File Size: {formatFileSize(version.file_size)}</div>
                          <div>Archived: {version.is_archived ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-secondary-900 mb-2">Metadata</h4>
                        <div className="text-xs bg-secondary-50 p-2 rounded">
                          <pre>{JSON.stringify(version.metadata, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {versions.length === 0 && !loading && (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No versions found</h3>
              <p className="text-secondary-600">Create the first version to get started</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'compare' && comparison && (
        <div className="space-y-6">
          {/* Comparison Header */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">Version Comparison</h3>
              <div className="flex items-center gap-4 text-sm text-secondary-600">
                <span>Version {comparison.version1.number}</span>
                <ArrowRight className="h-4 w-4" />
                <span>Version {comparison.version2.number}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{comparison.statistics.additions}</div>
                <div className="text-sm text-green-700">Additions</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{comparison.statistics.modifications}</div>
                <div className="text-sm text-yellow-700">Modifications</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{comparison.statistics.deletions}</div>
                <div className="text-sm text-red-700">Deletions</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{comparison.statistics.total_changes}</div>
                <div className="text-sm text-blue-700">Total Changes</div>
              </div>
            </div>
          </div>

          {/* Changes List */}
          <div className="space-y-4">
            {comparison.changes.map((change, index) => (
              <div key={change.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${changeTypeColors[change.change_type]}`}>
                      {change.change_type.toUpperCase()}
                    </span>
                    <span className={`text-sm font-medium ${impactColors[change.impact_assessment]}`}>
                      {change.impact_assessment.toUpperCase()} IMPACT
                    </span>
                  </div>
                  <span className="text-xs text-secondary-500">
                    Lines {change.line_start}-{change.line_end}
                  </span>
                </div>
                
                <p className="text-sm text-secondary-700 mb-3">{change.change_summary}</p>
                
                {(change.old_content || change.new_content) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {change.old_content && (
                      <div>
                        <h5 className="text-xs font-medium text-secondary-600 mb-2">Before:</h5>
                        <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                          <pre className="whitespace-pre-wrap">{change.old_content}</pre>
                        </div>
                      </div>
                    )}
                    {change.new_content && (
                      <div>
                        <h5 className="text-xs font-medium text-secondary-600 mb-2">After:</h5>
                        <div className="bg-green-50 border border-green-200 p-3 rounded text-sm">
                          <pre className="whitespace-pre-wrap">{change.new_content}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="space-y-4">
          {changes.map((change) => (
            <div key={change.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${changeTypeColors[change.change_type]}`}>
                    {change.change_type.toUpperCase()}
                  </span>
                  <span className={`text-sm font-medium ${impactColors[change.impact_assessment]}`}>
                    {change.impact_assessment.toUpperCase()} IMPACT
                  </span>
                </div>
                <div className="text-xs text-secondary-500">
                  v{change.from_version_number} → v{change.to_version_number}
                </div>
              </div>
              
              <p className="text-sm text-secondary-700">{change.change_summary}</p>
            </div>
          ))}
          
          {changes.length === 0 && (
            <div className="text-center py-12">
              <GitBranch className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No changes to display</h3>
              <p className="text-secondary-600">Select a version to view its changes</p>
            </div>
          )}
        </div>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">Create New Version</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Reason for Update
                </label>
                <input
                  type="text"
                  value={newVersionReason}
                  onChange={(e) => setNewVersionReason(e.target.value)}
                  placeholder="Brief description of changes..."
                  className="input w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Document Content
                </label>
                <textarea
                  value={newVersionContent}
                  onChange={(e) => setNewVersionContent(e.target.value)}
                  placeholder="Enter the updated document content..."
                  rows={12}
                  className="input w-full"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={createNewVersion}
                disabled={!newVersionContent.trim() || actionLoading === 'create'}
                className="btn btn-primary flex-1"
              >
                {actionLoading === 'create' ? 'Creating...' : 'Create Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}