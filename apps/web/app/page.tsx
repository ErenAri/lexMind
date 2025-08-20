"use client";

import { useState, useEffect } from "react";
import { useAuth } from '@/lib/auth';
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/ui/StatsCard";
import ComplianceCard from "@/components/ui/ComplianceCard";
import SearchBar from "@/components/ui/SearchBar";
import DocumentUpload from "@/components/DocumentUpload";
import RoleGuard from "@/components/RoleGuard";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Upload,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Mock data - in real app, this would come from your API
  const stats = {
    totalDocuments: 1247,
    complianceScore: 87,
    pendingReviews: 23,
    riskIssues: 5
  };

  const recentFindings = [
    {
      id: 1,
      title: "GDPR Data Processing Compliance",
      regulation: "GDPR Article 32",
      status: "non-compliant" as const,
      priority: "high" as const,
      lastUpdated: "2 hours ago",
      description: "Personal data processing procedures need encryption implementation.",
      progress: 45
    },
    {
      id: 2,
      title: "SOX Financial Controls Review",
      regulation: "SOX Section 404",
      status: "compliant" as const,
      priority: "medium" as const,
      lastUpdated: "1 day ago",
      description: "Internal control procedures are properly documented and effective.",
      progress: 100
    },
    {
      id: 3,
      title: "PCI DSS Payment Security",
      regulation: "PCI DSS v4.0",
      status: "pending" as const,
      priority: "high" as const,
      lastUpdated: "3 days ago",
      description: "Payment card data handling requires security assessment.",
      progress: 75
    }
  ];

  const handleUploadComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Implement search logic
  };

  return (
    <DashboardLayout 
      title="Compliance Dashboard"
      subtitle={`Welcome back, ${user?.username}. Here's your compliance overview.`}
      actions={
        <div className="flex items-center gap-3">
          <RoleGuard allowed={['analyst', 'admin']}>
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </RoleGuard>
          <button className="btn btn-secondary btn-md">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      }
    >
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Documents"
          value={stats.totalDocuments.toLocaleString()}
          change={{ value: "+12%", type: "increase" }}
          icon={FileText}
          description="Active compliance documents"
        />
        <StatsCard
          title="Compliance Score"
          value={`${stats.complianceScore}%`}
          change={{ value: "+3%", type: "increase" }}
          icon={CheckCircle}
          description="Overall compliance rating"
        />
        <StatsCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          change={{ value: "-8%", type: "decrease" }}
          icon={Clock}
          description="Documents awaiting review"
        />
        <StatsCard
          title="Risk Issues"
          value={stats.riskIssues}
          change={{ value: "+2", type: "increase" }}
          icon={AlertTriangle}
          description="High priority compliance gaps"
        />
      </div>

      {/* Search and Quick Actions */}
      <div className="mb-8">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Quick Search</h2>
          <SearchBar 
            placeholder="Search regulations, documents, findings..."
            onSearch={handleSearch}
            className="max-w-2xl"
          />
        </div>
      </div>

      {/* Recent Compliance Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-secondary-900">Recent Findings</h2>
            <button className="btn btn-ghost btn-sm">
              View All
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            {recentFindings.map((finding) => (
              <ComplianceCard
                key={finding.id}
                title={finding.title}
                regulation={finding.regulation}
                status={finding.status}
                priority={finding.priority}
                lastUpdated={finding.lastUpdated}
                description={finding.description}
                progress={finding.progress}
                actions={
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm">
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <RoleGuard allowed={['analyst', 'admin']}>
                      <button className="btn btn-ghost btn-sm">
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                    </RoleGuard>
                    <button className="btn btn-ghost btn-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Sidebar with additional info */}
        <div className="space-y-6">
          {/* Compliance Trends */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Compliance Trends</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">This Month</span>
                <span className="text-sm font-medium text-success-600">+5% ↗</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Last Quarter</span>
                <span className="text-sm font-medium text-success-600">+12% ↗</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Year to Date</span>
                <span className="text-sm font-medium text-success-600">+8% ↗</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="btn btn-secondary w-full justify-start">
                <FileText className="h-4 w-4" />
                Generate Report
              </button>
              <button className="btn btn-secondary w-full justify-start">
                <Search className="h-4 w-4" />
                Advanced Search
              </button>
              <RoleGuard allowed={['analyst', 'admin']}>
                <button className="btn btn-secondary w-full justify-start">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </button>
              </RoleGuard>
            </div>
          </div>

          {/* System Status */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">API Status</span>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-online"></div>
                  <span className="text-sm text-success-600">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Database</span>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-online"></div>
                  <span className="text-sm text-success-600">Connected</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">AI Services</span>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-warning"></div>
                  <span className="text-sm text-warning-600">Limited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}