'use client';

import React, { useState } from 'react';
import DashboardLayout from "@/components/DashboardLayout";
import RoleGuard from "@/components/RoleGuard";
import EnhancedDocumentUpload from "@/components/EnhancedDocumentUpload";
import DocumentLibrary from "@/components/documents/DocumentLibrary";
import { 
  Download, 
  Plus,
  Clock,
  Star,
  BarChart3,
  Folder,
  Search
} from "lucide-react";

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'favorites' | 'analytics'>('all');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const handleDocumentSelect = (doc: any) => {
    setSelectedDocument(doc);
    // Document viewer will be handled by DocumentLibrary component itself
    console.log('Selected document:', doc);
  };

  const handleUploadComplete = () => {
    // Refresh the document library without full page reload
    setActiveTab('all'); // Reset to default view
    // Force re-render by updating a key
    window.dispatchEvent(new CustomEvent('documentLibraryRefresh'));
  };

  const tabs = [
    { key: 'all', label: 'All Documents', icon: Folder, count: null },
    { key: 'recent', label: 'Recent', icon: Clock, count: null },
    { key: 'favorites', label: 'Favorites', icon: Star, count: null },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, count: null }
  ];

  return (
    <DashboardLayout
      title="Document Library"
      subtitle="Comprehensive document management with search, organization, and analytics"
      actions={
        <div className="flex items-center gap-3">
          <RoleGuard allowed={['analyst', 'admin']}>
            <EnhancedDocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      }
    >
      {/* Document Library Tabs */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count && (
                <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Document Library Content */}
      <div className="space-y-6">
        {activeTab === 'all' && (
          <DocumentLibrary
            mode="full"
            onDocumentSelect={handleDocumentSelect}
          />
        )}

        {activeTab === 'recent' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">Recently Accessed Documents</h3>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Documents you've viewed or modified in the past 30 days, sorted by most recent activity.
              </p>
            </div>
            
            <DocumentLibrary
              mode="recent"
              limit={50}
              onDocumentSelect={handleDocumentSelect}
            />
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <h3 className="font-medium text-yellow-900">Your Favorite Documents</h3>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Documents you've marked as favorites for quick access. Click the star icon on any document to add it here.
              </p>
            </div>
            
            <DocumentLibrary
              mode="favorites"
              onDocumentSelect={handleDocumentSelect}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium text-purple-900">Document Analytics</h3>
              </div>
              <p className="text-sm text-purple-700 mt-1">
                Insights into document usage, popular content, and access patterns across your organization.
              </p>
            </div>
            
            <DocumentAnalytics />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Document Analytics Component
function DocumentAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Most Popular Documents */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular This Week</h3>
        <div className="space-y-3">
          {[
            { name: "Goldman Sachs Trading Policy", views: 45, users: 12 },
            { name: "Risk Assessment Guidelines", views: 32, users: 8 },
            { name: "Compliance Training Manual", views: 28, users: 15 },
            { name: "SOX Audit Report 2024", views: 21, users: 6 },
            { name: "Data Privacy Policy", views: 18, users: 9 }
          ].map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{doc.name}</div>
                <div className="text-sm text-gray-600">{doc.users} unique users</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-blue-600">{doc.views}</div>
                <div className="text-xs text-gray-500">views</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Categories */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Distribution</h3>
        <div className="space-y-3">
          {[
            { category: "Policies", count: 156, percentage: 35, color: "bg-blue-500" },
            { category: "Regulations", count: 89, percentage: 20, color: "bg-green-500" },
            { category: "Training", count: 67, percentage: 15, color: "bg-yellow-500" },
            { category: "Audits", count: 45, percentage: 10, color: "bg-purple-500" },
            { category: "Legal", count: 34, percentage: 8, color: "bg-red-500" },
            { category: "Other", count: 53, percentage: 12, color: "bg-gray-500" }
          ].map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{item.category}</span>
                <span className="text-sm text-gray-600">{item.count} docs</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color}`}
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Access Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Trends</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Documents</span>
            <span className="text-2xl font-bold text-gray-900">1,247</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Documents Accessed This Week</span>
            <span className="text-2xl font-bold text-blue-600">384</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Average Daily Views</span>
            <span className="text-2xl font-bold text-green-600">127</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Users</span>
            <span className="text-2xl font-bold text-purple-600">43</span>
          </div>
        </div>
      </div>

      {/* Recently Added */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Added</h3>
        <div className="space-y-3">
          {[
            { name: "Updated Privacy Policy 2025", date: "2 hours ago", type: "Policy" },
            { name: "Q1 Risk Assessment Report", date: "1 day ago", type: "Audit" },
            { name: "New Employee Handbook", date: "2 days ago", type: "Training" },
            { name: "Basel III Implementation Guide", date: "3 days ago", type: "Regulation" }
          ].map((doc, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{doc.name}</div>
                <div className="text-sm text-gray-600">{doc.type}</div>
              </div>
              <div className="text-xs text-gray-500">{doc.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}