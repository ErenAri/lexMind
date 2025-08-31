'use client';

import React, { createContext, useContext, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

// Audit event types
export type AuditEventType = 
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
  | 'document.viewed'
  | 'document.downloaded'
  | 'document.shared'
  | 'document.version_created'
  | 'document.version_restored'
  | 'compliance.analysis_run'
  | 'compliance.finding_created'
  | 'compliance.finding_resolved'
  | 'system.backup_created'
  | 'system.settings_changed'
  | 'security.permission_granted'
  | 'security.permission_revoked'
  | 'security.access_denied'
  | 'data.exported'
  | 'data.imported'
  | 'api.called'
  | 'error.occurred';

// Risk levels for audit events
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Audit event structure
export interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  user_id: string;
  user_name: string;
  user_role: string;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  action: string;
  description: string;
  risk_level: RiskLevel;
  ip_address: string;
  user_agent: string;
  session_id?: string;
  metadata?: {
    previous_values?: any;
    new_values?: any;
    affected_users?: string[];
    file_size?: number;
    duration_ms?: number;
    error_message?: string;
    compliance_framework?: string;
    regulation_reference?: string;
    [key: string]: any;
  };
  compliance_relevant: boolean;
  retention_years: number;
}

// Batch configuration
interface BatchConfig {
  maxSize: number;
  flushInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number;
}

interface AuditContextType {
  log: (eventType: AuditEventType, action: string, details?: Partial<AuditEvent>) => void;
  logBulk: (events: Array<Partial<AuditEvent>>) => void;
  flush: () => Promise<void>;
  getStats: () => { pending: number; failed: number; sent: number };
}

const AuditContext = createContext<AuditContextType | null>(null);

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};

interface AuditProviderProps {
  children: React.ReactNode;
  config?: Partial<BatchConfig>;
}

export default function AuditProvider({ children, config: initialConfig }: AuditProviderProps) {
  const { token, user } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const config: BatchConfig = {
    maxSize: 50,
    flushInterval: 10000, // 10 seconds
    maxRetries: 3,
    retryDelay: 1000,
    ...initialConfig
  };

  // Batch storage
  const eventBatch = useRef<AuditEvent[]>([]);
  const failedEvents = useRef<AuditEvent[]>([]);
  const flushTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Statistics
  const stats = useRef({
    pending: 0,
    failed: 0,
    sent: 0
  });

  // Get client information
  const getClientInfo = useCallback(() => {
    return {
      ip_address: 'client', // Will be set by server
      user_agent: navigator.userAgent,
      session_id: sessionStorage.getItem('session_id') || undefined
    };
  }, []);

  // Determine risk level based on event type
  const determineRiskLevel = (eventType: AuditEventType): RiskLevel => {
    const riskMapping: Record<AuditEventType, RiskLevel> = {
      'user.login': 'low',
      'user.logout': 'low',
      'user.created': 'medium',
      'user.updated': 'medium',
      'user.deleted': 'high',
      'document.created': 'low',
      'document.updated': 'low',
      'document.deleted': 'medium',
      'document.viewed': 'low',
      'document.downloaded': 'medium',
      'document.shared': 'medium',
      'document.version_created': 'low',
      'document.version_restored': 'medium',
      'compliance.analysis_run': 'medium',
      'compliance.finding_created': 'medium',
      'compliance.finding_resolved': 'medium',
      'system.backup_created': 'low',
      'system.settings_changed': 'high',
      'security.permission_granted': 'high',
      'security.permission_revoked': 'high',
      'security.access_denied': 'critical',
      'data.exported': 'high',
      'data.imported': 'high',
      'api.called': 'low',
      'error.occurred': 'medium'
    };
    
    return riskMapping[eventType] || 'medium';
  };

  // Determine compliance relevance
  const isComplianceRelevant = (eventType: AuditEventType): boolean => {
    const complianceEvents: AuditEventType[] = [
      'user.created',
      'user.updated',
      'user.deleted',
      'document.created',
      'document.updated',
      'document.deleted',
      'document.shared',
      'compliance.analysis_run',
      'compliance.finding_created',
      'compliance.finding_resolved',
      'security.permission_granted',
      'security.permission_revoked',
      'security.access_denied',
      'data.exported',
      'data.imported'
    ];
    
    return complianceEvents.includes(eventType);
  };

  // Determine retention period
  const getRetentionYears = (eventType: AuditEventType, riskLevel: RiskLevel): number => {
    if (riskLevel === 'critical') return 10;
    if (riskLevel === 'high') return 7;
    if (isComplianceRelevant(eventType)) return 7;
    return 3; // Default retention
  };

  // Create audit event
  const createAuditEvent = (
    eventType: AuditEventType,
    action: string,
    details: Partial<AuditEvent> = {}
  ): AuditEvent => {
    const clientInfo = getClientInfo();
    const riskLevel = details.risk_level || determineRiskLevel(eventType);
    const complianceRelevant = details.compliance_relevant ?? isComplianceRelevant(eventType);
    const retentionYears = details.retention_years || getRetentionYears(eventType, riskLevel);

    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      user_id: user?.id || 'anonymous',
      user_name: user?.username || 'anonymous',
      user_role: user?.role || 'unknown',
      action,
      description: details.description || `${action} performed`,
      risk_level: riskLevel,
      compliance_relevant: complianceRelevant,
      retention_years: retentionYears,
      ...clientInfo,
      ...details
    };
  };

  // Add event to batch
  const addToBatch = useCallback((event: AuditEvent) => {
    eventBatch.current.push(event);
    stats.current.pending++;

    // Schedule flush if not already scheduled
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(() => {
        flush();
      }, config.flushInterval);
    }

    // Flush immediately if batch is full or event is critical
    if (eventBatch.current.length >= config.maxSize || event.risk_level === 'critical') {
      flush();
    }
  }, [config.maxSize, config.flushInterval]);

  // Send events to server
  const sendEvents = async (events: AuditEvent[], retryCount = 0): Promise<boolean> => {
    try {
      const response = await api.request('/api/v1/audit/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });

      if (response.ok) {
        stats.current.sent += events.length;
        stats.current.pending -= events.length;
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send audit events:', error);
      
      if (retryCount < config.maxRetries) {
        // Exponential backoff
        const delay = config.retryDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendEvents(events, retryCount + 1);
      }
      
      // Move to failed events after max retries
      failedEvents.current.push(...events);
      stats.current.failed += events.length;
      stats.current.pending -= events.length;
      
      return false;
    }
  };

  // Flush current batch
  const flush = useCallback(async () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }

    const currentBatch = [...eventBatch.current];
    eventBatch.current = [];

    if (currentBatch.length === 0) return;

    // Try to send current batch
    await sendEvents(currentBatch);

    // Also retry failed events if any
    if (failedEvents.current.length > 0) {
      const retryBatch = [...failedEvents.current];
      failedEvents.current = [];
      const success = await sendEvents(retryBatch);
      
      if (!success) {
        // If retry fails, they're already back in failedEvents
        console.warn(`Failed to retry ${retryBatch.length} audit events`);
      }
    }
  }, []);

  // Main logging function
  const log = useCallback((
    eventType: AuditEventType,
    action: string,
    details: Partial<AuditEvent> = {}
  ) => {
    if (!user) return; // Don't log if user not authenticated

    try {
      const event = createAuditEvent(eventType, action, details);
      addToBatch(event);
    } catch (error) {
      console.error('Failed to create audit event:', error);
    }
  }, [user, addToBatch]);

  // Bulk logging function
  const logBulk = useCallback((events: Array<Partial<AuditEvent>>) => {
    if (!user) return;

    try {
      events.forEach(eventDetails => {
        if (eventDetails.event_type && eventDetails.action) {
          const event = createAuditEvent(
            eventDetails.event_type,
            eventDetails.action,
            eventDetails
          );
          addToBatch(event);
        }
      });
    } catch (error) {
      console.error('Failed to create bulk audit events:', error);
    }
  }, [user, addToBatch]);

  // Get statistics
  const getStats = useCallback(() => {
    return { ...stats.current };
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
      // Flush remaining events
      flush();
    };
  }, [flush]);

  // Periodic flush for long-running sessions
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (eventBatch.current.length > 0) {
        flush();
      }
    }, config.flushInterval * 2); // Backup flush interval

    return () => clearInterval(interval);
  }, [flush, config.flushInterval]);

  return (
    <AuditContext.Provider value={{
      log,
      logBulk,
      flush,
      getStats
    }}>
      {children}
    </AuditContext.Provider>
  );
}