'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon: LucideIcon;
  description?: string;
  trend?: ReactNode;
}

export default function StatsCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  description, 
  trend 
}: StatsCardProps) {
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase':
        return 'text-success-600';
      case 'decrease':
        return 'text-danger-600';
      default:
        return 'text-secondary-600';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return '↗';
      case 'decrease':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-600">{title}</p>
              <p className="text-2xl font-bold text-secondary-900">{value}</p>
            </div>
          </div>
          
          {description && (
            <p className="mt-2 text-sm text-secondary-500">{description}</p>
          )}

          {change && (
            <div className="mt-2 flex items-center gap-1">
              <span className={`text-sm font-medium ${getChangeColor(change.type)}`}>
                {getChangeIcon(change.type)} {change.value}
              </span>
              <span className="text-sm text-secondary-500">vs last period</span>
            </div>
          )}
        </div>

        {trend && (
          <div className="ml-4">
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}