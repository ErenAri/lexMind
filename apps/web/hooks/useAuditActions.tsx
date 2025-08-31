'use client';

import { useCallback } from 'react';
import { useAudit } from '@/components/audit/AuditLogger';
import { useAuth } from '@/lib/auth';
import { AuditEventType } from '@/components/audit/AuditLogger';

// Hook for common audit actions
export function useAuditActions() {
  const { log } = useAudit();
  const { user } = useAuth();

  // User actions
  const auditUserLogin = useCallback((loginMethod?: string, ipAddress?: string) => {
    log('user.login', 'User logged in', {
      description: `User ${user?.username} logged in${loginMethod ? ` via ${loginMethod}` : ''}`,
      metadata: {
        login_method: loginMethod,
        ip_address: ipAddress
      }
    });
  }, [log, user]);

  const auditUserLogout = useCallback((reason?: string) => {
    log('user.logout', 'User logged out', {
      description: `User ${user?.username} logged out${reason ? ` (${reason})` : ''}`,
      metadata: { logout_reason: reason }
    });
  }, [log, user]);

  const auditUserCreated = useCallback((newUserId: string, newUserName: string, newUserRole: string) => {
    log('user.created', 'User account created', {
      description: `Created new user account: ${newUserName}`,
      resource_type: 'user',
      resource_id: newUserId,
      resource_name: newUserName,
      metadata: {
        new_user_role: newUserRole,
        created_by: user?.username
      }
    });
  }, [log, user]);

  const auditUserUpdated = useCallback(
    (targetUserId: string, targetUserName: string, changes: Record<string, any>, previousValues?: Record<string, any>) => {
      log('user.updated', 'User account updated', {
        description: `Updated user account: ${targetUserName}`,
        resource_type: 'user',
        resource_id: targetUserId,
        resource_name: targetUserName,
        metadata: {
          new_values: changes,
          previous_values: previousValues,
          updated_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditUserDeleted = useCallback((deletedUserId: string, deletedUserName: string) => {
    log('user.deleted', 'User account deleted', {
      description: `Deleted user account: ${deletedUserName}`,
      resource_type: 'user',
      resource_id: deletedUserId,
      resource_name: deletedUserName,
      risk_level: 'high',
      metadata: {
        deleted_by: user?.username
      }
    });
  }, [log, user]);

  // Document actions
  const auditDocumentCreated = useCallback(
    (documentId: string, documentTitle: string, documentType?: string, fileSize?: number) => {
      log('document.created', 'Document created', {
        description: `Created new document: ${documentTitle}`,
        resource_type: 'document',
        resource_id: documentId,
        resource_name: documentTitle,
        metadata: {
          document_type: documentType,
          file_size: fileSize,
          created_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditDocumentViewed = useCallback((documentId: string, documentTitle: string, viewDuration?: number) => {
    log('document.viewed', 'Document viewed', {
      description: `Viewed document: ${documentTitle}`,
      resource_type: 'document',
      resource_id: documentId,
      resource_name: documentTitle,
      risk_level: 'low',
      metadata: {
        view_duration_ms: viewDuration,
        viewed_by: user?.username
      }
    });
  }, [log, user]);

  const auditDocumentUpdated = useCallback(
    (documentId: string, documentTitle: string, changesSummary?: string, previousVersion?: string) => {
      log('document.updated', 'Document updated', {
        description: `Updated document: ${documentTitle}`,
        resource_type: 'document',
        resource_id: documentId,
        resource_name: documentTitle,
        metadata: {
          changes_summary: changesSummary,
          previous_version: previousVersion,
          updated_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditDocumentDeleted = useCallback((documentId: string, documentTitle: string) => {
    log('document.deleted', 'Document deleted', {
      description: `Deleted document: ${documentTitle}`,
      resource_type: 'document',
      resource_id: documentId,
      resource_name: documentTitle,
      risk_level: 'medium',
      metadata: {
        deleted_by: user?.username
      }
    });
  }, [log, user]);

  const auditDocumentDownloaded = useCallback(
    (documentId: string, documentTitle: string, format?: string, fileSize?: number) => {
      log('document.downloaded', 'Document downloaded', {
        description: `Downloaded document: ${documentTitle}`,
        resource_type: 'document',
        resource_id: documentId,
        resource_name: documentTitle,
        risk_level: 'medium',
        metadata: {
          download_format: format,
          file_size: fileSize,
          downloaded_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditDocumentShared = useCallback(
    (documentId: string, documentTitle: string, sharedWith: string[], permissions?: string[]) => {
      log('document.shared', 'Document shared', {
        description: `Shared document: ${documentTitle}`,
        resource_type: 'document',
        resource_id: documentId,
        resource_name: documentTitle,
        risk_level: 'medium',
        metadata: {
          shared_with: sharedWith,
          permissions: permissions,
          shared_by: user?.username
        }
      });
    }, [log, user]
  );

  // Version control actions
  const auditVersionCreated = useCallback(
    (documentId: string, documentTitle: string, versionId: string, versionNumber: number, changesSummary?: string) => {
      log('document.version_created', 'Document version created', {
        description: `Created version ${versionNumber} of document: ${documentTitle}`,
        resource_type: 'document_version',
        resource_id: versionId,
        resource_name: `${documentTitle} v${versionNumber}`,
        metadata: {
          document_id: documentId,
          version_number: versionNumber,
          changes_summary: changesSummary,
          created_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditVersionRestored = useCallback(
    (documentId: string, documentTitle: string, versionId: string, versionNumber: number) => {
      log('document.version_restored', 'Document version restored', {
        description: `Restored version ${versionNumber} of document: ${documentTitle}`,
        resource_type: 'document_version',
        resource_id: versionId,
        resource_name: `${documentTitle} v${versionNumber}`,
        risk_level: 'medium',
        metadata: {
          document_id: documentId,
          version_number: versionNumber,
          restored_by: user?.username
        }
      });
    }, [log, user]
  );

  // Security actions
  const auditPermissionGranted = useCallback(
    (targetUserId: string, targetUserName: string, permission: string, resourceType?: string, resourceId?: string) => {
      log('security.permission_granted', 'Permission granted', {
        description: `Granted ${permission} permission to ${targetUserName}`,
        resource_type: resourceType,
        resource_id: resourceId,
        risk_level: 'high',
        metadata: {
          target_user_id: targetUserId,
          target_user_name: targetUserName,
          permission: permission,
          granted_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditPermissionRevoked = useCallback(
    (targetUserId: string, targetUserName: string, permission: string, resourceType?: string, resourceId?: string) => {
      log('security.permission_revoked', 'Permission revoked', {
        description: `Revoked ${permission} permission from ${targetUserName}`,
        resource_type: resourceType,
        resource_id: resourceId,
        risk_level: 'high',
        metadata: {
          target_user_id: targetUserId,
          target_user_name: targetUserName,
          permission: permission,
          revoked_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditAccessDenied = useCallback(
    (resource: string, attemptedAction: string, reason?: string) => {
      log('security.access_denied', 'Access denied', {
        description: `Access denied for ${attemptedAction} on ${resource}`,
        resource_type: 'security',
        risk_level: 'critical',
        metadata: {
          attempted_action: attemptedAction,
          denial_reason: reason,
          denied_user: user?.username
        }
      });
    }, [log, user]
  );

  // Compliance actions
  const auditComplianceAnalysis = useCallback(
    (analysisId: string, framework: string, documentsAnalyzed: number, findingsCount: number) => {
      log('compliance.analysis_run', 'Compliance analysis performed', {
        description: `Ran ${framework} compliance analysis`,
        resource_type: 'compliance_analysis',
        resource_id: analysisId,
        resource_name: `${framework} Analysis`,
        metadata: {
          compliance_framework: framework,
          documents_analyzed: documentsAnalyzed,
          findings_count: findingsCount,
          analyzed_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditComplianceFinding = useCallback(
    (findingId: string, regulation: string, severity: string, description: string, documentId?: string) => {
      log('compliance.finding_created', 'Compliance finding identified', {
        description: `Compliance issue identified: ${description}`,
        resource_type: 'compliance_finding',
        resource_id: findingId,
        resource_name: `${regulation} Finding`,
        risk_level: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        metadata: {
          regulation_reference: regulation,
          finding_severity: severity,
          related_document_id: documentId,
          identified_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditFindingResolved = useCallback(
    (findingId: string, regulation: string, resolutionNotes?: string) => {
      log('compliance.finding_resolved', 'Compliance finding resolved', {
        description: `Resolved compliance finding for ${regulation}`,
        resource_type: 'compliance_finding',
        resource_id: findingId,
        resource_name: `${regulation} Finding`,
        metadata: {
          regulation_reference: regulation,
          resolution_notes: resolutionNotes,
          resolved_by: user?.username
        }
      });
    }, [log, user]
  );

  // Data operations
  const auditDataExport = useCallback(
    (exportType: string, recordCount: number, format: string, destination?: string) => {
      log('data.exported', 'Data exported', {
        description: `Exported ${recordCount} ${exportType} records`,
        risk_level: 'high',
        metadata: {
          export_type: exportType,
          record_count: recordCount,
          export_format: format,
          destination: destination,
          exported_by: user?.username
        }
      });
    }, [log, user]
  );

  const auditDataImport = useCallback(
    (importType: string, recordCount: number, source: string, errors?: number) => {
      log('data.imported', 'Data imported', {
        description: `Imported ${recordCount} ${importType} records`,
        risk_level: 'high',
        metadata: {
          import_type: importType,
          record_count: recordCount,
          import_source: source,
          error_count: errors,
          imported_by: user?.username
        }
      });
    }, [log, user]
  );

  // System actions
  const auditSystemSettingsChanged = useCallback(
    (settingName: string, newValue: any, previousValue?: any) => {
      log('system.settings_changed', 'System settings modified', {
        description: `Changed system setting: ${settingName}`,
        risk_level: 'high',
        metadata: {
          setting_name: settingName,
          new_value: newValue,
          previous_value: previousValue,
          changed_by: user?.username
        }
      });
    }, [log, user]
  );

  // API actions
  const auditApiCall = useCallback(
    (endpoint: string, method: string, statusCode: number, responseTime: number, errorMessage?: string) => {
      log('api.called', 'API endpoint accessed', {
        description: `${method} ${endpoint} - ${statusCode}`,
        risk_level: statusCode >= 400 ? 'medium' : 'low',
        metadata: {
          endpoint: endpoint,
          http_method: method,
          status_code: statusCode,
          response_time_ms: responseTime,
          error_message: errorMessage,
          called_by: user?.username
        }
      });
    }, [log, user]
  );

  // Error tracking
  const auditError = useCallback(
    (errorType: string, errorMessage: string, stackTrace?: string, context?: Record<string, any>) => {
      log('error.occurred', 'Application error', {
        description: `${errorType}: ${errorMessage}`,
        risk_level: 'medium',
        metadata: {
          error_type: errorType,
          error_message: errorMessage,
          stack_trace: stackTrace,
          context: context,
          user: user?.username
        }
      });
    }, [log, user]
  );

  return {
    // User actions
    auditUserLogin,
    auditUserLogout,
    auditUserCreated,
    auditUserUpdated,
    auditUserDeleted,

    // Document actions
    auditDocumentCreated,
    auditDocumentViewed,
    auditDocumentUpdated,
    auditDocumentDeleted,
    auditDocumentDownloaded,
    auditDocumentShared,

    // Version control
    auditVersionCreated,
    auditVersionRestored,

    // Security actions
    auditPermissionGranted,
    auditPermissionRevoked,
    auditAccessDenied,

    // Compliance actions
    auditComplianceAnalysis,
    auditComplianceFinding,
    auditFindingResolved,

    // Data operations
    auditDataExport,
    auditDataImport,

    // System actions
    auditSystemSettingsChanged,

    // API and errors
    auditApiCall,
    auditError
  };
}