'use client';

import { useState, useEffect } from 'react';
import { 
  Bell,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  FileText,
  User,
  Shield,
  Trash2,
  MarkAsRead,
  Settings
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  category: 'system' | 'compliance' | 'document' | 'user';
  actionUrl?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'warning',
      title: 'Compliance Issue Detected',
      message: 'GDPR data retention policy needs review in privacy-policy.pdf',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      category: 'compliance',
      actionUrl: '/documents/privacy-policy.pdf'
    },
    {
      id: '2',
      type: 'success',
      title: 'Document Analysis Complete',
      message: 'Successfully processed and indexed 5 new compliance documents',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      read: false,
      category: 'document'
    },
    {
      id: '3',
      type: 'info',
      title: 'New User Registered',
      message: 'analyst@company.com has joined your organization',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      read: true,
      category: 'user'
    },
    {
      id: '4',
      type: 'info',
      title: 'Weekly Compliance Report',
      message: 'Your weekly compliance summary is ready for review',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true,
      category: 'system'
    },
    {
      id: '5',
      type: 'error',
      title: 'AI Service Disruption',
      message: 'Ollama service was temporarily unavailable. Service restored.',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      read: true,
      category: 'system'
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return AlertTriangle;
      default: return Info;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'compliance': return Shield;
      case 'document': return FileText;
      case 'user': return User;
      default: return Settings;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-success-600';
      case 'warning': return 'text-warning-600';
      case 'error': return 'text-danger-600';
      default: return 'text-primary-600';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={onClose} />
      
      {/* Notification Panel */}
      <div className="fixed top-16 right-4 w-96 max-h-96 bg-white rounded-lg shadow-xl border border-secondary-200 z-50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-secondary-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-secondary-900 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-danger-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-secondary-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`text-sm px-3 py-1 rounded-full transition-colors ${
                  filter === 'all' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-secondary-600 hover:text-secondary-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`text-sm px-3 py-1 rounded-full transition-colors ${
                  filter === 'unread' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-secondary-600 hover:text-secondary-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-3 text-secondary-300" />
              <p className="text-secondary-600">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-secondary-100">
              {filteredNotifications.map((notification) => {
                const Icon = getIcon(notification.type);
                const CategoryIcon = getCategoryIcon(notification.category);
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-secondary-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 ${getTypeColor(notification.type)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-secondary-900' : 'text-secondary-700'
                          }`}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <CategoryIcon className="h-3 w-3 text-secondary-400" />
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-secondary-400 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-secondary-600 mt-1">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-secondary-500">
                            {formatTimeAgo(notification.timestamp)}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            {notification.actionUrl && (
                              <button className="text-xs text-primary-600 hover:text-primary-700">
                                View
                              </button>
                            )}
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-primary-600 hover:text-primary-700"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-secondary-200 bg-secondary-50">
          <button className="text-sm text-center w-full text-primary-600 hover:text-primary-700">
            View all notifications
          </button>
        </div>
      </div>
    </>
  );
}