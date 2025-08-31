"use client";

import { useState, useEffect } from "react";
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { fetchJson, getBaseApiUrl } from '@/lib/api';
import PageWrapper from "@/components/PageWrapper";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCard from "@/components/ui/StatsCard";
import ComplianceCard from "@/components/ui/ComplianceCard";
import SearchBar from "@/components/ui/SearchBar";
import FindingsList from "@/components/FindingsList";
import CoveragePanel from "@/components/CoveragePanel";
import DocumentUpload from "@/components/DocumentUpload";
import RoleGuard from "@/components/RoleGuard";
import ComplianceDashboard from "@/components/ComplianceDashboard";
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
  Download,
  MessageCircle
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    complianceScore: 0,
    pendingReviews: 0,
    riskIssues: 0
  });

  // Fetch real stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use getBaseApiUrl for consistency and proper API versioning
        const baseUrl = getBaseApiUrl();
        const response = await fetchJson(`${baseUrl}/compliance/dashboard`);
        
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalDocuments: data.total_documents,
            complianceScore: Math.round(data.average_score),
            pendingReviews: Math.max(0, data.total_documents - data.analyzed_documents),
            riskIssues: (data.risk_distribution?.high || 0) + (data.risk_distribution?.critical || 0)
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
  }, [refreshKey]);

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
    <PageWrapper>
      <DashboardLayout 
        title="LexMind Compliance Dashboard"
        subtitle={`Welcome back, ${user?.username}!`}
        actions={
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary btn-md">
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        }
      >
      {/* Compliance Analytics Dashboard */}
      <div className="mb-12">
        <ComplianceDashboard />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Stats & Upload */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Key Metrics */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </section>

          {/* Document Management */}
          <RoleGuard allowed={['analyst', 'admin']}>
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Document Management</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Upload Section */}
                <div className="lg:col-span-2">
                  <div className="card p-6 border-2 border-dashed border-blue-200 bg-white/80 backdrop-blur-sm hover:border-blue-300 transition-colors">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Upload Documents</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Add regulations, policies, and company documents for analysis
                      </p>
                      <DocumentUpload onUploadComplete={handleUploadComplete} />
                    </div>
                  </div>
                </div>

                {/* Search & Analyze Section */}
                <div className="lg:col-span-1">
                  <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Search className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Search & Analyze</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Find compliance gaps and analyze documents
                      </p>
                      <div className="space-y-3">
                        <SearchBar 
                          placeholder="Search documents..."
                          onSearch={handleSearch}
                          className="w-full text-sm"
                        />
                        <button 
                          onClick={() => {
                            console.log('🔍 Advanced Search clicked');
                            try { router.push('/search'); } catch (e) { console.error(e); }
                          }}
                          className="btn btn-secondary btn-sm w-full hover:bg-green-100 transition-colors"
                        >
                          <Search className="h-4 w-4" />
                          Advanced Search
                        </button>
                        <button 
                          onClick={() => {
                            console.log('🤖 AI Chat clicked');
                            try { router.push('/chat'); } catch (e) { console.error(e); }
                          }}
                          className="btn btn-primary btn-sm w-full"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Findings Section - always include component so tests can detect it */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Results</h3>
                <FindingsList query={searchQuery} />
              </div>
            </section>
          </RoleGuard>

        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="card p-6">
              <div className="space-y-3">
                <button className="btn btn-secondary w-full justify-start">
                  <FileText className="h-4 w-4" />
                  Generate Report
                </button>
                {user?.role !== 'viewer' && (
                  <button className="btn btn-secondary w-full justify-start">
                    <Upload className="h-4 w-4" />
                    Bulk Upload
                  </button>
                )}
                <button className="btn btn-secondary w-full justify-start">
                  <TrendingUp className="h-4 w-4" />
                  View Analytics
                </button>
              </div>
            </div>
          </section>

          {/* System Status */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="card p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Connected</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">AI Services</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-yellow-600">Limited</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Coverage Panel */}
          <section>
            <CoveragePanel />
          </section>

          {/* Compliance Trends */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trends</h3>
            <div className="card p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-sm font-medium text-green-600">+5% ↗</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Quarter</span>
                  <span className="text-sm font-medium text-green-600">+12% ↗</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Year to Date</span>
                  <span className="text-sm font-medium text-green-600">+8% ↗</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Recent Findings Section */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Compliance Findings</h2>
          <button className="btn btn-ghost btn-sm">
            View All
            <TrendingUp className="h-4 w-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                </div>
              }
            />
          ))}
        </div>
      </section>
      </DashboardLayout>
    </PageWrapper>
  );
}