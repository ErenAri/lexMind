'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from "@/components/DashboardLayout";
import SearchBar from "@/components/ui/SearchBar";
import RoleGuard from "@/components/RoleGuard";
import DocumentUpload from "@/components/DocumentUpload";
import { 
  FileText, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Calendar,
  User,
  Tag,
  Upload
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: 'regulation' | 'policy' | 'procedure' | 'contract';
  status: 'active' | 'draft' | 'archived' | 'review';
  lastModified: string;
  author: string;
  size: string;
  tags: string[];
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('lastModified');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Mock data - replace with actual API call
  const mockDocuments: Document[] = [
    {
      id: '1',
      name: 'GDPR Compliance Policy',
      type: 'policy',
      status: 'active',
      lastModified: '2024-01-15',
      author: 'Sarah Johnson',
      size: '2.4 MB',
      tags: ['GDPR', 'Privacy', 'EU', 'Data Protection']
    },
    {
      id: '2',
      name: 'SOX Financial Controls',
      type: 'procedure',
      status: 'review',
      lastModified: '2024-01-14',
      author: 'Michael Chen',
      size: '1.8 MB',
      tags: ['SOX', 'Financial', 'Audit', 'Controls']
    },
    {
      id: '3',
      name: 'PCI DSS Requirements',
      type: 'regulation',
      status: 'active',
      lastModified: '2024-01-12',
      author: 'Emily Davis',
      size: '3.2 MB',
      tags: ['PCI', 'Security', 'Payment', 'Compliance']
    },
    {
      id: '4',
      name: 'Vendor Agreement Template',
      type: 'contract',
      status: 'draft',
      lastModified: '2024-01-10',
      author: 'David Wilson',
      size: '892 KB',
      tags: ['Vendor', 'Contract', 'Legal', 'Template']
    }
  ];

  useEffect(() => {
    // Simulate API call
    setDocuments(mockDocuments);
    setFilteredDocuments(mockDocuments);
  }, []);

  useEffect(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'all' || doc.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'lastModified':
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, selectedType, selectedStatus, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'draft': return 'badge-warning';
      case 'archived': return 'badge-secondary';
      case 'review': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'regulation': return '📋';
      case 'policy': return '📄';
      case 'procedure': return '📝';
      case 'contract': return '📜';
      default: return '📄';
    }
  };

  const handleUploadComplete = () => {
    // Refresh documents list
    console.log('Upload completed');
  };

  return (
    <DashboardLayout
      title="Document Management"
      subtitle="Manage compliance documents, policies, and regulations"
      actions={
        <div className="flex items-center gap-3">
          <RoleGuard allowed={['analyst', 'admin']}>
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
          <button className="btn btn-secondary btn-md">
            <Download className="h-4 w-4" />
            Export List
          </button>
        </div>
      }
    >
      {/* Filters and Search */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <SearchBar
              placeholder="Search documents, tags, authors..."
              onSearch={setSearchQuery}
              showFilters={false}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input text-sm min-w-32"
            >
              <option value="all">All Types</option>
              <option value="regulation">Regulations</option>
              <option value="policy">Policies</option>
              <option value="procedure">Procedures</option>
              <option value="contract">Contracts</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input text-sm min-w-32"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-sm min-w-32"
            >
              <option value="lastModified">Last Modified</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-secondary-600">
          Showing {filteredDocuments.length} of {documents.length} documents
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

      {/* Documents List */}
      {viewMode === 'list' ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-200">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Document</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Type</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Status</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Author</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Modified</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-secondary-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-secondary-100 hover:bg-secondary-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTypeIcon(doc.type)}</span>
                        <div>
                          <div className="font-medium text-secondary-900">{doc.name}</div>
                          <div className="text-sm text-secondary-500">{doc.size}</div>
                          <div className="flex items-center gap-1 mt-1">
                            {doc.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="badge badge-secondary text-xs">
                                {tag}
                              </span>
                            ))}
                            {doc.tags.length > 3 && (
                              <span className="text-xs text-secondary-500">+{doc.tags.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize text-sm text-secondary-700">{doc.type}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`badge ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-secondary-400" />
                        <span className="text-sm text-secondary-700">{doc.author}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-secondary-400" />
                        <span className="text-sm text-secondary-700">{doc.lastModified}</span>
                      </div>
                    </td>
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
                          <Download className="h-4 w-4" />
                        </button>
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
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{getTypeIcon(doc.type)}</span>
                <span className={`badge ${getStatusColor(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
              
              <h3 className="font-semibold text-secondary-900 mb-2 line-clamp-2">{doc.name}</h3>
              
              <div className="text-sm text-secondary-600 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3 w-3" />
                  {doc.author}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3 w-3" />
                  {doc.lastModified}
                </div>
                <div className="text-xs text-secondary-500">{doc.size}</div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {doc.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="badge badge-secondary text-xs">
                    {tag}
                  </span>
                ))}
                {doc.tags.length > 2 && (
                  <span className="text-xs text-secondary-500">+{doc.tags.length - 2}</span>
                )}
              </div>

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
      )}

      {/* Empty State */}
      {filteredDocuments.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">No documents found</h3>
          <p className="text-secondary-600 mb-4">
            {searchQuery ? 'Try adjusting your search criteria' : 'Get started by uploading your first document'}
          </p>
          <RoleGuard allowed={['analyst', 'admin']}>
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
        </div>
      )}
    </DashboardLayout>
  );
}