'use client';

import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ComplianceCardProps {
  title: string;
  regulation: string;
  status: 'compliant' | 'non-compliant' | 'pending' | 'review';
  lastUpdated: string;
  priority: 'high' | 'medium' | 'low';
  description?: string;
  actions?: ReactNode;
  progress?: number;
}

export default function ComplianceCard({
  title,
  regulation,
  status,
  lastUpdated,
  priority,
  description,
  actions,
  progress
}: ComplianceCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'compliant':
        return {
          icon: CheckCircle,
          color: 'text-success-600',
          bgColor: 'bg-success-100',
          label: 'Compliant'
        };
      case 'non-compliant':
        return {
          icon: XCircle,
          color: 'text-danger-600',
          bgColor: 'bg-danger-100',
          label: 'Non-Compliant'
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-warning-600',
          bgColor: 'bg-warning-100',
          label: 'Pending Review'
        };
      case 'review':
        return {
          icon: AlertTriangle,
          color: 'text-warning-600',
          bgColor: 'bg-warning-100',
          label: 'Needs Review'
        };
      default:
        return {
          icon: Clock,
          color: 'text-secondary-600',
          bgColor: 'bg-secondary-100',
          label: 'Unknown'
        };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-danger-100 text-danger-700';
      case 'medium':
        return 'bg-warning-100 text-warning-700';
      case 'low':
        return 'bg-success-100 text-success-700';
      default:
        return 'bg-secondary-100 text-secondary-700';
    }
  };

  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusConfig.bgColor}`}>
              <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-secondary-900">{title}</h3>
                <span className={`badge ${getPriorityColor(priority)} text-xs`}>
                  {priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-secondary-600 mt-1">{regulation}</p>
            </div>
          </div>

          {/* Description */}
          {description && (
            <p className="mt-3 text-sm text-secondary-700 line-clamp-2">{description}</p>
          )}

          {/* Progress bar */}
          {progress !== undefined && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-secondary-600">Compliance Progress</span>
                <span className="font-medium text-secondary-900">{progress}%</span>
              </div>
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`badge ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-secondary-500">
              Updated {lastUpdated}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="mt-4 pt-4 border-t border-secondary-200">
          {actions}
        </div>
      )}
    </div>
  );
}