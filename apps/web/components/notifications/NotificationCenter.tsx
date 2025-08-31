'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  BellRing,
  X, 
  Check, 
  CheckCheck,
  Settings,
  Filter,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  User,
  FileText,
  MessageSquare,
  GitBranch,
  Shield,
  Trash2,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'document' | 'collaboration' | 'system' | 'security' | 'compliance';
  title: string;
  message: string;
  metadata?: {
    document_id?: string;
    document_title?: string;
    user_id?: string;
    username?: string;
    action_url?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function NotificationCenter({ isOpen, onToggle }: NotificationCenterProps) {
  const { token, user } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'document' | 'collaboration' | 'system'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    push_notifications: true,
    document_notifications: true,
    collaboration_notifications: true,
    system_notifications: true,
    security_notifications: true
  });
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      loadPreferences();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.request('/api/v1/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await api.request('/api/v1/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...preferences, ...data.preferences });
      }
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setActionLoading(prev => new Set(prev).add(notificationId));
      const response = await api.request(`/api/v1/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setActionLoading(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await api.request('/api/v1/notifications/read-all', {
        method: 'PATCH'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      setActionLoading(prev => new Set(prev).add(notificationId));
      const response = await api.request(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    } finally {
      setActionLoading(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const bulkAction = async (action: 'read' | 'delete') => {
    try {
      const notificationIds = Array.from(selectedNotifications);
      const response = await api.request('/api/v1/notifications/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notification_ids: notificationIds, 
          action 
        })
      });
      
      if (response.ok) {
        if (action === 'read') {
          setNotifications(prev => prev.map(n => 
            selectedNotifications.has(n.id) ? { ...n, is_read: true } : n
          ));
        } else if (action === 'delete') {
          setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
        }
        setSelectedNotifications(new Set());
      }
    } catch (err) {
      console.error(`Failed to ${action} notifications:`, err);
    }
  };

  const savePreferences = async () => {
    try {
      const response = await api.request('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences })
      });
      
      if (response.ok) {
        setShowSettings(false);
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const getNotificationIcon = (type: string, category: string) => {
    if (type === 'error' || type === 'warning') return <AlertTriangle className="h-5 w-5" />;
    if (type === 'success') return <CheckCircle className="h-5 w-5" />;
    
    switch (category) {
      case 'document': return <FileText className="h-5 w-5" />;
      case 'collaboration': return <MessageSquare className="h-5 w-5" />;
      case 'system': return <Settings className="h-5 w-5" />;
      case 'security': return <Shield className="h-5 w-5" />;
      case 'compliance': return <CheckCircle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string, category: string) => {
    if (type === 'error') return 'text-red-600 bg-red-100';
    if (type === 'warning') return 'text-yellow-600 bg-yellow-100';
    if (type === 'success') return 'text-green-600 bg-green-100';
    
    switch (category) {
      case 'document': return 'text-blue-600 bg-blue-100';
      case 'collaboration': return 'text-purple-600 bg-purple-100';
      case 'system': return 'text-gray-600 bg-gray-100';
      case 'security': return 'text-red-600 bg-red-100';
      case 'compliance': return 'text-green-600 bg-green-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getPriorityIndicator = (priority?: string) => {
    switch (priority) {
      case 'urgent': return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />;
      case 'high': return <div className="w-2 h-2 bg-orange-500 rounded-full" />;
      case 'medium': return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'low': return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      default: return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread' && notification.is_read) return false;
    if (filter !== 'all' && filter !== 'unread' && notification.category !== filter) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className="fixed top-16 right-4 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </div>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Notification settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={onToggle}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 mt-3">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'document', label: 'Docs', count: notifications.filter(n => n.category === 'document').length },
            { key: 'collaboration', label: 'Team', count: notifications.filter(n => n.category === 'collaboration').length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.size > 0 && (
          <div className="flex items-center justify-between mt-3 p-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {selectedNotifications.size} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => bulkAction('read')}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mark Read
              </button>
              <button
                onClick={() => bulkAction('delete')}
                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {unreadCount > 0 && (
          <div className="mt-2">
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-3">Notification Preferences</h3>
          <div className="space-y-2">
            {[
              { key: 'email_notifications', label: 'Email notifications' },
              { key: 'push_notifications', label: 'Push notifications' },
              { key: 'document_notifications', label: 'Document updates' },
              { key: 'collaboration_notifications', label: 'Collaboration activity' },
              { key: 'system_notifications', label: 'System messages' },
              { key: 'security_notifications', label: 'Security alerts' }
            ].map(pref => (
              <label key={pref.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{pref.label}</span>
                <input
                  type="checkbox"
                  checked={preferences[pref.key as keyof typeof preferences]}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    [pref.key]: e.target.checked
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-2 mt-3">
            <button
              onClick={() => setShowSettings(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={savePreferences}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex space-x-3 p-3 border border-gray-200 rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
            <p className="text-gray-600">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications to show'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  !notification.is_read ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.has(notification.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedNotifications);
                      if (e.target.checked) {
                        newSelected.add(notification.id);
                      } else {
                        newSelected.delete(notification.id);
                      }
                      setSelectedNotifications(newSelected);
                    }}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  
                  <div className={`p-2 rounded-lg ${getNotificationColor(notification.type, notification.category)}`}>
                    {getNotificationIcon(notification.type, notification.category)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{notification.title}</h4>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          {getPriorityIndicator(notification.metadata?.priority)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        
                        {notification.metadata?.document_title && (
                          <div className="flex items-center space-x-1 mt-2 text-xs text-gray-500">
                            <FileText className="h-3 w-3" />
                            <span>{notification.metadata.document_title}</span>
                          </div>
                        )}
                        
                        {notification.metadata?.username && (
                          <div className="flex items-center space-x-1 mt-1 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            <span>{notification.metadata.username}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                          
                          {notification.metadata?.action_url && (
                            <button className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800">
                              <ExternalLink className="h-3 w-3" />
                              <span>View</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-1 ml-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            disabled={actionLoading.has(notification.id)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Mark as read"
                          >
                            {actionLoading.has(notification.id) ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          disabled={actionLoading.has(notification.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}