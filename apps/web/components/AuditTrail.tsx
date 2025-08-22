'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  Activity,
  TrendingUp,
  Filter,
  Calendar,
  Download,
  Eye,
  Search,
  BarChart3,
  PieChart,
  LineChart,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Target,
  Zap
} from 'lucide-react';

interface AuditEvent {
  event_id: string;
  event_type: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_path?: string;
  user_id?: string;
  user_role?: string;
  metadata: any;
  compliance_impact: any;
  risk_level: string;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
  created_at: string;
}

interface ComplianceReport {
  report_id: string;
  report_type: string;
  title: string;
  generated_by: string;
  generated_for: string;
  date_range_start: string;
  date_range_end: string;
  compliance_score?: number;
  risk_score?: number;
  status: string;
  created_at: string;
}

interface AuditDashboard {
  period_days: number;
  statistics: {
    total_events: number;
    failed_events: number;
    high_risk_events: number;
    active_users: number;
    compliance_events: number;
    security_events: number;
  };
  trends: Array<{
    event_date: string;
    event_count: number;
    failed_count: number;
    risk_count: number;
  }>;
  top_users: Array<{
    user_id: string;
    action_count: number;
    failed_count: number;
  }>;
  recent_events: AuditEvent[];
}

export default function AuditTrail() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AuditDashboard | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'reports'>('dashboard');
  const [filters, setFilters] = useState({
    event_types: '',
    actions: '',
    resource_types: '',
    user_id: '',
    start_date: '',
    end_date: '',
    risk_levels: ''
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [newReport, setNewReport] = useState({
    report_type: 'audit_summary',
    title: '',
    start_date: '',
    end_date: '',
    filters: {}
  });

  const eventTypeColors = {
    user_action: 'bg-blue-100 text-blue-800',
    system_action: 'bg-gray-100 text-gray-800',
    compliance_event: 'bg-green-100 text-green-800',
    security_event: 'bg-red-100 text-red-800',
    workflow_event: 'bg-purple-100 text-purple-800'
  };

  const riskLevelColors = {
    none: 'text-secondary-600',
    low: 'text-success-600',
    medium: 'text-warning-600',
    high: 'text-danger-600',
    critical: 'text-red-600'
  };

  const reportTypes = [
    { value: 'audit_summary', label: 'Audit Summary', icon: BarChart3 },
    { value: 'compliance_status', label: 'Compliance Status', icon: Shield },
    { value: 'risk_assessment', label: 'Risk Assessment', icon: AlertTriangle },
    { value: 'user_activity', label: 'User Activity', icon: User },
    { value: 'security_events', label: 'Security Events', icon: Target }
  ];

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboard(),
        loadEvents(),
        loadReports()
      ]);
    } catch (error) {
      console.error('Failed to load audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/dashboard?days=30`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
      params.append('limit', '100');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/events?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadReports = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/reports`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const generateReport = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newReport),
      });

      if (response.ok) {
        setShowReportModal(false);
        setNewReport({
          report_type: 'audit_summary',
          title: '',
          start_date: '',
          end_date: '',
          filters: {}
        });
        await loadReports();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await loadReports();
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-secondary-900 mb-2">Access Restricted</h3>
        <p className="text-secondary-600">Only administrators can access the audit trail</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary-600" />
            Audit Trail & Compliance Reporting
          </h2>
          <p className="text-secondary-600">Monitor system activity and generate compliance reports</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4" />
            Generate Report
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary btn-md"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'dashboard' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'events' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Audit Events
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'reports' 
              ? 'bg-white text-secondary-900 shadow-sm' 
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Reports
        </button>
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">Total Events</h3>
                  <p className="text-3xl font-bold text-primary-600">{dashboard.statistics.total_events.toLocaleString()}</p>
                </div>
                <Activity className="h-12 w-12 text-primary-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">Last {dashboard.period_days} days</p>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">Failed Events</h3>
                  <p className="text-3xl font-bold text-danger-600">{dashboard.statistics.failed_events}</p>
                </div>
                <AlertTriangle className="h-12 w-12 text-danger-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">
                {((dashboard.statistics.failed_events / dashboard.statistics.total_events) * 100).toFixed(1)}% failure rate
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">High Risk Events</h3>
                  <p className="text-3xl font-bold text-warning-600">{dashboard.statistics.high_risk_events}</p>
                </div>
                <Target className="h-12 w-12 text-warning-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">Require immediate attention</p>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">Active Users</h3>
                  <p className="text-3xl font-bold text-success-600">{dashboard.statistics.active_users}</p>
                </div>
                <User className="h-12 w-12 text-success-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">Unique users with activity</p>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">Compliance Events</h3>
                  <p className="text-3xl font-bold text-green-600">{dashboard.statistics.compliance_events}</p>
                </div>
                <Shield className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">Compliance-related activities</p>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">Security Events</h3>
                  <p className="text-3xl font-bold text-red-600">{dashboard.statistics.security_events}</p>
                </div>
                <Target className="h-12 w-12 text-red-600" />
              </div>
              <p className="text-sm text-secondary-600 mt-2">Security-related incidents</p>
            </div>
          </div>

          {/* Top Users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Most Active Users</h3>
              <div className="space-y-3">
                {dashboard.top_users.slice(0, 5).map((userActivity, index) => (
                  <div key={userActivity.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-secondary-700">#{index + 1}</div>
                      <User className="h-4 w-4 text-secondary-600" />
                      <span className="font-medium text-secondary-900">{userActivity.user_id}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-secondary-900">{userActivity.action_count} actions</div>
                      {userActivity.failed_count > 0 && (
                        <div className="text-xs text-danger-600">{userActivity.failed_count} failed</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Events</h3>
              <div className="space-y-3">
                {dashboard.recent_events.slice(0, 5).map((event) => (
                  <div key={event.event_id} className="flex items-start gap-3">
                    <div className={`text-xs px-2 py-1 rounded-full ${eventTypeColors[event.event_type as keyof typeof eventTypeColors]}`}>
                      {event.event_type}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-secondary-900">
                        {event.action} {event.resource_type}
                      </div>
                      <div className="text-xs text-secondary-600">
                        {event.user_id} • {formatDateTime(event.created_at)}
                      </div>
                    </div>
                    {!event.success && (
                      <AlertTriangle className="h-4 w-4 text-danger-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Event Types</label>
                <input
                  type="text"
                  placeholder="user_action,compliance_event"
                  value={filters.event_types}
                  onChange={(e) => setFilters(prev => ({ ...prev, event_types: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Actions</label>
                <input
                  type="text"
                  placeholder="create,update,delete"
                  value={filters.actions}
                  onChange={(e) => setFilters(prev => ({ ...prev, actions: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">User ID</label>
                <input
                  type="text"
                  placeholder="user123"
                  value={filters.user_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, user_id: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Risk Levels</label>
                <input
                  type="text"
                  placeholder="high,critical"
                  value={filters.risk_levels}
                  onChange={(e) => setFilters(prev => ({ ...prev, risk_levels: e.target.value }))}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={loadEvents}
                className="btn btn-primary"
              >
                <Search className="h-4 w-4" />
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({
                    event_types: '',
                    actions: '',
                    resource_types: '',
                    user_id: '',
                    start_date: '',
                    end_date: '',
                    risk_levels: ''
                  });
                  loadEvents();
                }}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.event_id} className="card p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${eventTypeColors[event.event_type as keyof typeof eventTypeColors]}`}>
                      {event.event_type}
                    </span>
                    <span className="font-medium text-secondary-900">
                      {event.action} {event.resource_type}
                    </span>
                    {event.resource_id && (
                      <span className="text-sm text-secondary-600">#{event.resource_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${riskLevelColors[event.risk_level as keyof typeof riskLevelColors]}`}>
                      {event.risk_level.toUpperCase()}
                    </span>
                    {event.success ? (
                      <CheckCircle className="h-4 w-4 text-success-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-danger-600" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-600">User:</span>
                    <span className="ml-2 font-medium">{event.user_id || 'System'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">Role:</span>
                    <span className="ml-2 font-medium">{event.user_role || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">Time:</span>
                    <span className="ml-2 font-medium">{formatDateTime(event.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">Duration:</span>
                    <span className="ml-2 font-medium">{event.duration_ms ? `${event.duration_ms}ms` : 'N/A'}</span>
                  </div>
                </div>

                {event.resource_path && (
                  <div className="mt-2 text-sm">
                    <span className="text-secondary-600">Resource:</span>
                    <span className="ml-2 font-mono text-secondary-800">{event.resource_path}</span>
                  </div>
                )}

                {event.error_message && (
                  <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded text-sm text-danger-700">
                    {event.error_message}
                  </div>
                )}
              </div>
            ))}

            {events.length === 0 && !loading && (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No audit events found</h3>
                <p className="text-secondary-600">Try adjusting your filters or date range</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {reports.map((report) => {
              const reportType = reportTypes.find(t => t.value === report.report_type);
              const ReportIcon = reportType?.icon || FileText;
              
              return (
                <div key={report.report_id} className="card p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary-100 rounded-lg">
                        <ReportIcon className="h-6 w-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-secondary-900">{report.title}</h3>
                        <p className="text-sm text-secondary-600">{reportType?.label || report.report_type}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-secondary-500">
                          <span>Generated by {report.generated_by}</span>
                          <span>•</span>
                          <span>{formatDateTime(report.created_at)}</span>
                          <span>•</span>
                          <span>{new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {report.compliance_score !== null && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary-600">{report.compliance_score}%</div>
                          <div className="text-xs text-secondary-600">Compliance</div>
                        </div>
                      )}
                      {report.risk_score !== null && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-warning-600">{report.risk_score}%</div>
                          <div className="text-xs text-secondary-600">Risk</div>
                        </div>
                      )}
                      <button className="btn btn-ghost btn-sm">
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        onClick={() => deleteReport(report.report_id)}
                        className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {reports.length === 0 && !loading && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">No reports generated</h3>
                <p className="text-secondary-600">Generate your first compliance report to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">Generate Compliance Report</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Report Type</label>
                <select
                  value={newReport.report_type}
                  onChange={(e) => setNewReport(prev => ({ ...prev, report_type: e.target.value }))}
                  className="input w-full"
                >
                  {reportTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newReport.title}
                  onChange={(e) => setNewReport(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Monthly Compliance Report"
                  className="input w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={newReport.start_date}
                  onChange={(e) => setNewReport(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={newReport.end_date}
                  onChange={(e) => setNewReport(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input w-full"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowReportModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={generateReport}
                disabled={!newReport.title || !newReport.start_date || !newReport.end_date}
                className="btn btn-primary flex-1"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}