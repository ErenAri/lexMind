'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield,
  AlertTriangle,
  Clock,
  Users,
  FileText,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';
import { AuditEvent, AuditEventType, RiskLevel } from './AuditLogger';
import RoleGuard from '../RoleGuard';
import DashboardLayout from '../DashboardLayout';

interface AuditStats {
  total_events: number;
  events_by_risk: Record<RiskLevel, number>;
  events_by_type: Record<string, number>;
  unique_users: number;
  compliance_events: number;
  failed_logins: number;
  data_exports: number;
  system_changes: number;
  time_range: {
    start: string;
    end: string;
  };
  trends: {
    daily_events: Array<{ date: string; count: number }>;
    risk_distribution: Array<{ risk: RiskLevel; count: number; percentage: number }>;
    top_users: Array<{ user_name: string; event_count: number }>;
    top_actions: Array<{ action: string; count: number }>;
  };
}

interface FilterOptions {
  dateRange: 'today' | '7days' | '30days' | '90days' | 'custom';
  riskLevel: RiskLevel | 'all';
  eventType: AuditEventType | 'all';
  userId: string;
  searchQuery: string;
  customDateStart?: string;
  customDateEnd?: string;
}

export default function AuditDashboard() {
  const { token, user } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '30days',
    riskLevel: 'all',
    eventType: 'all',
    userId: '',
    searchQuery: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });

  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAuditData();
  }, [filters, pagination.page]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        date_range: filters.dateRange,
        ...(filters.riskLevel !== 'all' && { risk_level: filters.riskLevel }),
        ...(filters.eventType !== 'all' && { event_type: filters.eventType }),
        ...(filters.userId && { user_id: filters.userId }),
        ...(filters.searchQuery && { search: filters.searchQuery }),
        ...(filters.customDateStart && { start_date: filters.customDateStart }),
        ...(filters.customDateEnd && { end_date: filters.customDateEnd })
      });

      // Load audit events
      const eventsResponse = await api.request(`/api/v1/audit/events?${params}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData.events || []);
        setPagination(prev => ({ ...prev, total: eventsData.total || 0 }));
      }

      // Load statistics
      const statsResponse = await api.request(`/api/v1/audit/stats?${params}`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load audit data');
      console.error('Audit data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportAuditLog = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        date_range: filters.dateRange,
        ...(filters.riskLevel !== 'all' && { risk_level: filters.riskLevel }),
        ...(filters.eventType !== 'all' && { event_type: filters.eventType }),
        ...(filters.userId && { user_id: filters.userId }),
        ...(filters.searchQuery && { search: filters.searchQuery })
      });

      const response = await api.request(`/api/v1/audit/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export audit log:', err);
    }
  };

  const getRiskLevelColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-green-700 bg-green-100 border-green-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getRiskLevelIcon = (risk: RiskLevel) => {
    switch (risk) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <AlertCircle className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    if (eventType.startsWith('user.')) return <Users className="h-4 w-4" />;
    if (eventType.startsWith('document.')) return <FileText className="h-4 w-4" />;
    if (eventType.startsWith('security.')) return <Shield className="h-4 w-4" />;
    if (eventType.startsWith('compliance.')) return <CheckCircle className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredStats = useMemo(() => {
    if (!stats) return null;
    
    return {
      ...stats,
      events_by_risk: Object.entries(stats.events_by_risk).map(([risk, count]) => ({
        risk: risk as RiskLevel,
        count,
        percentage: stats.total_events > 0 ? (count / stats.total_events) * 100 : 0
      }))
    };
  }, [stats]);

  if (loading && !stats) {
    return (
      <RoleGuard allowed={['admin']}>
        <DashboardLayout title="Audit Dashboard" subtitle="Loading audit data...">
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-center">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Loading audit logs...</p>
            </div>
          </div>
        </DashboardLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowed={['admin']}>
      <DashboardLayout 
        title="Audit Dashboard" 
        subtitle="Monitor system activity and compliance events"
        actions={
          <div className="flex items-center space-x-3">
            <button
              onClick={exportAuditLog}
              className="btn btn-secondary btn-md flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        }
      >
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-red-800 font-medium">Failed to load audit data</p>
            </div>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Statistics Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_events.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unique Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unique_users}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Compliance Events</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.compliance_events}</p>
                </div>
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Failed Logins</p>
                  <p className="text-2xl font-bold text-red-900">{stats.failed_logins}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>
        )}

        {/* Risk Distribution */}
        {filteredStats && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
            <div className="space-y-3">
              {filteredStats.events_by_risk.map((item) => (
                <div key={item.risk} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${getRiskLevelColor(item.risk)}`}>
                      {getRiskLevelIcon(item.risk)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 capitalize">{item.risk} Risk</span>
                      <p className="text-sm text-gray-600">{item.count} events</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-gray-900">{item.percentage.toFixed(1)}%</span>
                    <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                      <div 
                        className={`h-2 rounded-full ${item.risk === 'critical' ? 'bg-red-500' : item.risk === 'high' ? 'bg-orange-500' : item.risk === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search audit events..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
              
              <select
                value={filters.riskLevel}
                onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value as any })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Events Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
          </div>

          <div className="divide-y divide-gray-200">
            {events.length === 0 ? (
              <div className="p-8 text-center">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No audit events</h4>
                <p className="text-gray-600">No events match your current filters.</p>
              </div>
            ) : (
              events.map((event) => {
                const isExpanded = expandedEvents.has(event.id);
                
                return (
                  <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`p-2 rounded-lg ${getRiskLevelColor(event.risk_level)}`}>
                          {getRiskLevelIcon(event.risk_level)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {getEventTypeIcon(event.event_type)}
                            <span className="font-medium text-gray-900">{event.action}</span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-mono">
                              {event.event_type}
                            </span>
                            {event.compliance_relevant && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                Compliance
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-700 mb-2">{event.description}</p>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{event.user_name} ({event.user_role})</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(event.timestamp)}</span>
                            </div>
                            {event.resource_name && (
                              <div className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>{event.resource_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleEventExpansion(event.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 ml-14 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Event ID:</span>
                            <p className="text-gray-600 font-mono text-xs">{event.id}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">IP Address:</span>
                            <p className="text-gray-600">{event.ip_address}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">User Agent:</span>
                            <p className="text-gray-600 truncate" title={event.user_agent}>
                              {event.user_agent}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Retention:</span>
                            <p className="text-gray-600">{event.retention_years} years</p>
                          </div>
                          {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="col-span-2">
                              <span className="font-medium text-gray-700">Metadata:</span>
                              <pre className="text-xs text-gray-600 mt-1 p-2 bg-white rounded border overflow-auto">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md">
                    {pagination.page}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page * pagination.limit >= pagination.total}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}