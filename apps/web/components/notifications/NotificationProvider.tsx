'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';
import { Notification } from './NotificationCenter';
import NotificationToast from './NotificationToast';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  requestPermission: () => Promise<boolean>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const { token, user } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [toastQueue, setToastQueue] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Load initial notifications
  useEffect(() => {
    if (token && user) {
      loadNotifications();
      connectWebSocket();
    }
  }, [token, user]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [wsConnection]);

  const loadNotifications = async () => {
    try {
      const response = await api.request('/api/v1/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!token || !user) return;

    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/notifications?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Notification WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'notification':
              const notification = data.notification as Notification;
              setNotifications(prev => [notification, ...prev]);
              
              // Show toast for high priority notifications
              if (notification.metadata?.priority === 'urgent' || notification.metadata?.priority === 'high') {
                showToast(notification.title, notification.type);
              }
              
              // Request browser notification permission and show native notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notification.title, {
                  body: notification.message,
                  icon: '/favicon.ico',
                  tag: notification.id,
                  requireInteraction: notification.metadata?.priority === 'urgent'
                });
              }
              break;

            case 'bulk_update':
              if (data.action === 'mark_read') {
                setNotifications(prev => prev.map(n => 
                  data.notification_ids.includes(n.id) ? { ...n, is_read: true } : n
                ));
              } else if (data.action === 'delete') {
                setNotifications(prev => prev.filter(n => !data.notification_ids.includes(n.id)));
              }
              break;

            case 'heartbeat':
              // Keep connection alive
              break;

            default:
              console.log('Unknown notification message type:', data.type);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('Notification WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after delay
        setTimeout(() => {
          if (token && user) {
            connectWebSocket();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
        setIsConnected(false);
      };

      setWsConnection(ws);
    } catch (err) {
      console.error('Failed to connect to notification WebSocket:', err);
      setIsConnected(false);
    }
  }, [token, user, api]);

  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => {
    const notification: Notification = {
      ...notificationData,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setNotifications(prev => [notification, ...prev]);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await api.request(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        ));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [api]);

  const markAllAsRead = useCallback(async () => {
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
  }, [api]);

  const removeNotification = useCallback(async (id: string) => {
    try {
      const response = await api.request(`/api/v1/notifications/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove notification:', err);
    }
  }, [api]);

  const clearAll = useCallback(async () => {
    try {
      const response = await api.request('/api/v1/notifications/clear-all', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  }, [api]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now().toString();
    const toast = { id, message, type };
    
    setToastQueue(prev => [...prev, toast]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToastQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isConnected,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      requestPermission,
      showToast
    }}>
      {children}
      
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toastQueue.map((toast) => (
          <NotificationToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}