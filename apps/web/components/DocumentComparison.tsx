'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  GitCompare,
  FileText,
  Plus,
  Minus,
  ArrowRight,
  RotateCcw,
  Download,
  Eye,
  Search,
  Filter,
  Calendar,
  User
} from 'lucide-react';

interface Document {
  id: number;
  path: string;
  content: string;
  created_at: string;
  chunk_idx: number;
}

interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  oldText?: string;
  newText?: string;
  text?: string;
  lineNumber?: number;
}

export default function DocumentComparison() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc1, setSelectedDoc1] = useState<Document | null>(null);
  const [selectedDoc2, setSelectedDoc2] = useState<Document | null>(null);
  const [comparison, setComparison] = useState<DiffSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/v1/documents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Convert documents to expected format
        const docList = data.documents?.map((doc: any) => ({
          id: doc.id || Math.random(),
          path: doc.name || doc.path || 'Unknown',
          content: '', // Will load on selection
          created_at: doc.uploadedAt || new Date().toISOString(),
          chunk_idx: 0
        })) || [];
        setDocuments(docList);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadDocumentContent = async (docPath: string): Promise<string> => {
    try {
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(docPath)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.content || '';
      }
    } catch (error) {
      console.error('Failed to load document content:', error);
    }
    return '';
  };

  const performComparison = async () => {
    if (!selectedDoc1 || !selectedDoc2) return;

    setLoading(true);
    try {
      // Load content for both documents
      const [content1, content2] = await Promise.all([
        loadDocumentContent(selectedDoc1.path),
        loadDocumentContent(selectedDoc2.path)
      ]);

      // Perform diff analysis
      const diff = generateDiff(content1, content2);
      setComparison(diff);
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDiff = (text1: string, text2: string): DiffSegment[] => {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const diff: DiffSegment[] = [];

    let i = 0, j = 0;
    let lineNumber = 1;

    while (i < lines1.length || j < lines2.length) {
      const line1 = lines1[i];
      const line2 = lines2[j];

      if (i >= lines1.length) {
        // Only lines2 remaining - all added
        diff.push({
          type: 'added',
          newText: line2,
          lineNumber: lineNumber++
        });
        j++;
      } else if (j >= lines2.length) {
        // Only lines1 remaining - all removed
        diff.push({
          type: 'removed',
          oldText: line1,
          lineNumber: lineNumber++
        });
        i++;
      } else if (line1 === line2) {
        // Lines are identical
        diff.push({
          type: 'unchanged',
          text: line1,
          lineNumber: lineNumber++
        });
        i++;
        j++;
      } else {
        // Lines are different
        // Simple heuristic: check if next lines match
        const nextMatch1 = lines2.indexOf(line1, j);
        const nextMatch2 = lines1.indexOf(line2, i);

        if (nextMatch1 !== -1 && (nextMatch2 === -1 || nextMatch1 < nextMatch2)) {
          // line1 appears later in lines2, so lines before it were added
          while (j < nextMatch1) {
            diff.push({
              type: 'added',
              newText: lines2[j],
              lineNumber: lineNumber++
            });
            j++;
          }
        } else if (nextMatch2 !== -1) {
          // line2 appears later in lines1, so lines before it were removed
          while (i < nextMatch2) {
            diff.push({
              type: 'removed',
              oldText: lines1[i],
              lineNumber: lineNumber++
            });
            i++;
          }
        } else {
          // Lines are just different
          diff.push({
            type: 'modified',
            oldText: line1,
            newText: line2,
            lineNumber: lineNumber++
          });
          i++;
          j++;
        }
      }
    }

    return diff;
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : 
        part
    );
  };

  const getSegmentClass = (type: string) => {
    switch (type) {
      case 'added': return 'bg-green-50 border-l-4 border-green-500';
      case 'removed': return 'bg-red-50 border-l-4 border-red-500';
      case 'modified': return 'bg-yellow-50 border-l-4 border-yellow-500';
      default: return 'bg-white';
    }
  };

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="h-4 w-4 text-green-600" />;
      case 'removed': return <Minus className="h-4 w-4 text-red-600" />;
      case 'modified': return <RotateCcw className="h-4 w-4 text-yellow-600" />;
      default: return null;
    }
  };

  const exportComparison = () => {
    if (!comparison.length) return;

    const content = comparison.map(segment => {
      switch (segment.type) {
        case 'added':
          return `+ ${segment.newText}`;
        case 'removed':
          return `- ${segment.oldText}`;
        case 'modified':
          return `- ${segment.oldText}\n+ ${segment.newText}`;
        default:
          return `  ${segment.text}`;
      }
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${selectedDoc1?.path}-${selectedDoc2?.path}.diff`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredComparison = showOnlyChanges 
    ? comparison.filter(segment => segment.type !== 'unchanged')
    : comparison;

  const stats = {
    added: comparison.filter(s => s.type === 'added').length,
    removed: comparison.filter(s => s.type === 'removed').length,
    modified: comparison.filter(s => s.type === 'modified').length,
    unchanged: comparison.filter(s => s.type === 'unchanged').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <GitCompare className="h-8 w-8 text-primary-600" />
            Document Comparison
          </h2>
          <p className="text-secondary-600">Compare two documents to identify changes and differences</p>
        </div>
        
        {comparison.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={exportComparison}
              className="btn btn-outline flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Diff
            </button>
          </div>
        )}
      </div>

      {/* Document Selection */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Select Documents to Compare</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document 1 */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Original Document
            </label>
            <select
              value={selectedDoc1?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id.toString() === e.target.value);
                setSelectedDoc1(doc || null);
              }}
              className="input w-full"
            >
              <option value="">Select original document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.path} ({new Date(doc.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Document 2 */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Modified Document
            </label>
            <select
              value={selectedDoc2?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id.toString() === e.target.value);
                setSelectedDoc2(doc || null);
              }}
              className="input w-full"
            >
              <option value="">Select modified document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.path} ({new Date(doc.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compare Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={performComparison}
            disabled={!selectedDoc1 || !selectedDoc2 || loading}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <GitCompare className="h-4 w-4" />
            )}
            {loading ? 'Comparing...' : 'Compare Documents'}
          </button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison.length > 0 && (
        <>
          {/* Stats and Controls */}
          <div className="card p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Statistics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.added}</div>
                  <div className="text-sm text-secondary-600">Added</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.removed}</div>
                  <div className="text-sm text-secondary-600">Removed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.modified}</div>
                  <div className="text-sm text-secondary-600">Modified</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary-600">{stats.unchanged}</div>
                  <div className="text-sm text-secondary-600">Unchanged</div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-secondary-700">View:</label>
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'side-by-side' | 'unified')}
                    className="input w-auto text-sm"
                  >
                    <option value="side-by-side">Side by Side</option>
                    <option value="unified">Unified</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showOnlyChanges}
                    onChange={(e) => setShowOnlyChanges(e.target.checked)}
                    className="rounded"
                  />
                  Show only changes
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Search in diff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10 w-48 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Display */}
          <div className="card">
            {viewMode === 'side-by-side' ? (
              /* Side by Side View */
              <div className="grid grid-cols-2 divide-x divide-secondary-200">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-secondary-200">
                    <FileText className="h-4 w-4 text-secondary-600" />
                    <span className="font-medium text-secondary-900">{selectedDoc1?.path}</span>
                  </div>
                  <div className="space-y-1 font-mono text-sm">
                    {filteredComparison.map((segment, index) => (
                      <div key={index} className={`p-2 rounded ${getSegmentClass(segment.type)}`}>
                        {segment.type === 'removed' || segment.type === 'modified' ? (
                          <div className="flex items-center gap-2">
                            {getSegmentIcon(segment.type)}
                            <span>{highlightSearchTerm(segment.oldText || '')}</span>
                          </div>
                        ) : segment.type === 'unchanged' ? (
                          <span className="text-secondary-600">{highlightSearchTerm(segment.text || '')}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-secondary-200">
                    <FileText className="h-4 w-4 text-secondary-600" />
                    <span className="font-medium text-secondary-900">{selectedDoc2?.path}</span>
                  </div>
                  <div className="space-y-1 font-mono text-sm">
                    {filteredComparison.map((segment, index) => (
                      <div key={index} className={`p-2 rounded ${getSegmentClass(segment.type)}`}>
                        {segment.type === 'added' || segment.type === 'modified' ? (
                          <div className="flex items-center gap-2">
                            {getSegmentIcon(segment.type)}
                            <span>{highlightSearchTerm(segment.newText || '')}</span>
                          </div>
                        ) : segment.type === 'unchanged' ? (
                          <span className="text-secondary-600">{highlightSearchTerm(segment.text || '')}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Unified View */
              <div className="p-6">
                <div className="space-y-1 font-mono text-sm">
                  {filteredComparison.map((segment, index) => (
                    <div key={index} className={`p-2 rounded ${getSegmentClass(segment.type)}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary-500 w-8">{segment.lineNumber}</span>
                        {getSegmentIcon(segment.type)}
                        <span>
                          {segment.type === 'modified' ? (
                            <div>
                              <div className="text-red-600">- {highlightSearchTerm(segment.oldText || '')}</div>
                              <div className="text-green-600">+ {highlightSearchTerm(segment.newText || '')}</div>
                            </div>
                          ) : (
                            highlightSearchTerm(segment.text || segment.oldText || segment.newText || '')
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedDoc1 || !selectedDoc2 ? (
        <div className="card p-12 text-center">
          <GitCompare className="h-16 w-16 mx-auto mb-4 text-secondary-400" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Select Two Documents to Compare
          </h3>
          <p className="text-secondary-600">
            Choose documents from the dropdowns above to see their differences
          </p>
        </div>
      ) : comparison.length === 0 && !loading ? (
        <div className="card p-12 text-center">
          <Eye className="h-16 w-16 mx-auto mb-4 text-secondary-400" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Ready to Compare
          </h3>
          <p className="text-secondary-600">
            Click "Compare Documents" to analyze the differences
          </p>
        </div>
      ) : null}
    </div>
  );
}