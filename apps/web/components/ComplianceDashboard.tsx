'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getBaseApiUrl } from '@/lib/api';
import { 
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Clock,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';

interface ComplianceStatus {
  doc_id: number;
  path: string;
  overall_score: number | null;
  risk_level: string;
  compliance_status: string;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  last_analyzed: string;
  categories: string[] | null;
}

interface DashboardData {
  total_documents: number;
  analyzed_documents: number;
  average_score: number;
  compliance_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  recent_analyses: ComplianceStatus[];
  top_issues: Array<{
    title: string;
    description: string;
    risk_level: string;
    category: string;
    frequency: number;
  }>;
  framework_coverage: Array<{
    name: string;
    full_name: string;
    category: string;
    coverage: number;
  }>;
}

export default function ComplianceDashboard() {
  const { user, token } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const baseUrl = getBaseApiUrl();
      const response = await fetch(`${baseUrl}/compliance/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        console.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard loading error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600';
    if (score >= 60) return 'text-warning-600';
    return 'text-danger-600';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'badge-success';
    if (score >= 60) return 'badge-warning';
    return 'badge-danger';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success-600';
      case 'medium': return 'text-warning-600';
      case 'high': return 'text-danger-600';
      case 'critical': return 'text-danger-800';
      default: return 'text-secondary-600';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'high': return 'badge-danger';
      case 'critical': return 'bg-danger-800 text-white';
      default: return 'badge-secondary';
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-success-600';
      case 'partially_compliant': return 'text-warning-600';
      case 'non_compliant': return 'text-danger-600';
      default: return 'text-secondary-600';
    }
  };

  const getComplianceStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return CheckCircle;
      case 'partially_compliant': return AlertTriangle;
      case 'non_compliant': return AlertCircle;
      default: return Info;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-secondary-600">Loading compliance dashboard...</span>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning-600" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">No Data Available</h3>
          <p className="text-secondary-600 mb-4">Upload some documents to see compliance analytics</p>
          <button onClick={refreshDashboard} className="btn btn-primary">
            Refresh Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { 
    total_documents, 
    analyzed_documents, 
    average_score,
    compliance_distribution,
    risk_distribution,
    recent_analyses,
    top_issues,
    framework_coverage
  } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">Compliance Dashboard</h2>
          <p className="text-secondary-600">Real-time compliance analysis and risk assessment</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const baseUrl = getBaseApiUrl();
                await fetch(`${baseUrl}/compliance/analyze-all`, { method: 'POST' });
                await refreshDashboard();
              } catch (e) {
                // ignore for UI
              }
            }}
            className="btn btn-primary"
          >
            Analyze all
          </button>
          <button
            onClick={refreshDashboard}
            disabled={refreshing}
            className="btn btn-outline flex items-center gap-2"
          >
            <Activity className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-600">Total Documents</p>
              <p className="text-2xl font-bold text-secondary-900">{total_documents}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-secondary-600">
              {analyzed_documents} analyzed ({total_documents > 0 ? Math.round((analyzed_documents / total_documents) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-600">Average Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(average_score)}`}>
                {average_score.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-secondary-600">Progress</span>
              <span className="text-xs text-secondary-600">{average_score.toFixed(0)}/100</span>
            </div>
            <div className="w-full bg-secondary-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  average_score >= 80 ? 'bg-success-500' :
                  average_score >= 60 ? 'bg-warning-500' : 'bg-danger-500'
                }`}
                style={{ width: `${Math.min(average_score, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-600">High Risk Docs</p>
              <p className="text-2xl font-bold text-warning-600">
                {(risk_distribution.high || 0) + (risk_distribution.critical || 0)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-secondary-600">
              Require immediate attention
            </span>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-secondary-600">Compliant</p>
              <p className="text-2xl font-bold text-success-600">
                {compliance_distribution.compliant || 0}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-success-600 mr-1" />
            <span className="text-success-600">Meeting standards</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Distribution */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <PieChart className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Compliance Status</h3>
          </div>
          
          <div className="space-y-4">
            {Object.entries(compliance_distribution).map(([status, count]) => {
              const total = Object.values(compliance_distribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const StatusIcon = getComplianceStatusIcon(status);
              
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-4 w-4 ${getComplianceStatusColor(status)}`} />
                    <span className="capitalize text-secondary-700">
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-secondary-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          status === 'compliant' ? 'bg-success-500' :
                          status === 'partially_compliant' ? 'bg-warning-500' : 'bg-danger-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="font-medium text-secondary-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Risk Levels</h3>
          </div>
          
          <div className="space-y-4">
            {['critical', 'high', 'medium', 'low'].map((risk) => {
              const count = risk_distribution[risk] || 0;
              const total = Object.values(risk_distribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={risk} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      risk === 'critical' ? 'bg-danger-800' :
                      risk === 'high' ? 'bg-danger-500' :
                      risk === 'medium' ? 'bg-warning-500' : 'bg-success-500'
                    }`}></div>
                    <span className="capitalize text-secondary-700">{risk} Risk</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-secondary-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          risk === 'critical' ? 'bg-danger-800' :
                          risk === 'high' ? 'bg-danger-500' :
                          risk === 'medium' ? 'bg-warning-500' : 'bg-success-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="font-medium text-secondary-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Analyses & Top Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Analyses */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Recent Analyses</h3>
          </div>
          
          <div className="space-y-4">
            {recent_analyses.slice(0, 5).map((analysis) => (
              <div key={analysis.doc_id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-secondary-900 truncate">
                    {analysis.path.split('/').pop() || 'Unknown Document'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${getRiskBadgeColor(analysis.risk_level)} text-xs`}>
                      {analysis.risk_level}
                    </span>
                    {analysis.overall_score && (
                      <span className={`badge ${getScoreBadgeColor(analysis.overall_score)} text-xs`}>
                        {analysis.overall_score.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary-600">
                    {analysis.total_issues} issues
                  </p>
                  <p className="text-xs text-secondary-500">
                    {new Date(analysis.last_analyzed).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            
            {recent_analyses.length === 0 && (
              <div className="text-center py-8 text-secondary-600">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No analyses yet</p>
                <p className="text-sm">Upload documents to see analysis results</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Issues */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Common Issues</h3>
          </div>
          
          <div className="space-y-4">
            {top_issues.slice(0, 5).map((issue, index) => (
              <div key={index} className="p-3 bg-secondary-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-secondary-900 text-sm">{issue.title}</h4>
                  <span className={`badge ${getRiskBadgeColor(issue.risk_level)} text-xs ml-2`}>
                    {issue.risk_level}
                  </span>
                </div>
                <p className="text-xs text-secondary-600 mb-2">{issue.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary-500 capitalize">
                    {issue.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-medium text-secondary-700">
                    {issue.frequency} occurrence{issue.frequency !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
            
            {top_issues.length === 0 && (
              <div className="text-center py-8 text-secondary-600">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success-500" />
                <p>No common issues found</p>
                <p className="text-sm">Great compliance status!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Framework Coverage */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-secondary-900">Compliance Frameworks</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {framework_coverage.map((framework) => (
            <div key={framework.name} className="p-4 bg-secondary-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-secondary-900">{framework.name}</h4>
                <span className="text-xs text-secondary-500 capitalize">
                  {framework.category.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-secondary-600 mb-3">{framework.full_name}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary-500">Coverage</span>
                <span className="text-sm font-medium text-secondary-700">{framework.coverage}%</span>
              </div>
              <div className="w-full bg-secondary-200 rounded-full h-1.5 mt-2">
                <div 
                  className="h-1.5 rounded-full bg-primary-500"
                  style={{ width: `${framework.coverage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}