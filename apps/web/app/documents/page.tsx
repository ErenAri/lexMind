'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/ui/SearchBar";
import RoleGuard from "@/components/RoleGuard";
import EnhancedDocumentUpload from "@/components/EnhancedDocumentUpload";
import { 
  FileText, 
  Download, 
  Eye, 
  Edit, 
  MoreHorizontal,
  Calendar
} from "lucide-react";
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

type ApiDocumentItem = {
  path: string;
  display_name: string;
  description: string | null;
  resolved: boolean;
  first_seen: string | null;
  last_seen: string | null;
  chunks: number;
  type: 'doc' | 'reg';
};

export default function DocumentsPage() {
  const { token } = useAuth();
  const api = useMemo(() => createApiClient(token), [token]);
  const [documents, setDocuments] = useState<ApiDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.request('/documents');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = await res.json();
        if (!cancelled) setDocuments(json.documents || []);
      } catch (e) {
        console.error('Failed to load documents', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [api]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (documents || []).filter(d => {
      if (!q) return true;
      return (
        d.display_name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q)
      );
    });
  }, [documents, searchQuery]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reg': return '📋';
      case 'doc': return '📄';
      default: return '📄';
    }
  };

  const handleUploadComplete = () => {
    // Could refetch here
  };

  return (
    <DashboardLayout
      title="Document Management"
      subtitle="Manage compliance documents, policies, and regulations"
      actions={
        <div className="flex items-center gap-3">
          <RoleGuard allowed={['analyst', 'admin']}>
            <EnhancedDocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
          <button className="btn btn-secondary btn-md">
            <Download className="h-4 w-4" />
            Export List
          </button>
        </div>
      }
    >
      <div className="card p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              placeholder="Search documents..."
              onSearch={setSearchQuery}
              showFilters={false}
            />
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
      </div>

      {isLoading && (
        <div className="card p-6">Loading...</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">No documents found</h3>
          <p className="text-secondary-600 mb-4">Upload a document to get started</p>
          <RoleGuard allowed={['analyst', 'admin']}>
            <EnhancedDocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        viewMode === 'list' ? (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary-50 border-b border-secondary-200">
                  <tr>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Document</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Type</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">First Seen</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Last Seen</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Chunks</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr key={doc.path} className="border-b border-secondary-100 hover:bg-secondary-50">
                      <td className="py-4 px-6">
                        <div className="font-medium text-secondary-900">{doc.display_name}</div>
                        <div className="text-sm text-secondary-500">{doc.path}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="capitalize text-sm text-secondary-700">{doc.type}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-secondary-400" />
                          <span className="text-sm text-secondary-700">{doc.first_seen || '-'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-secondary-400" />
                          <span className="text-sm text-secondary-700">{doc.last_seen || '-'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">{doc.chunks}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button className="btn btn-ghost btn-sm">
                            <Eye className="h-4 w-4" />
                          </button>
                          <RoleGuard allowed={['analyst', 'admin']}>
                            <button className="btn btn-ghost btn-sm">
                              <Edit className="h-4 w-4" />
                            </button>
                          </RoleGuard>
                          <button className="btn btn-ghost btn-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((doc) => (
              <div key={doc.path} className="card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{getTypeIcon(doc.type)}</span>
                </div>
                <h3 className="font-semibold text-secondary-900 mb-2 line-clamp-2">{doc.display_name}</h3>
                <div className="text-sm text-secondary-600 mb-3">{doc.path}</div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost btn-sm flex-1">
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <RoleGuard allowed={['analyst', 'admin']}>
                    <button className="btn btn-ghost btn-sm">
                      <Edit className="h-4 w-4" />
                    </button>
                  </RoleGuard>
                  <button className="btn btn-ghost btn-sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </DashboardLayout>
  );
}