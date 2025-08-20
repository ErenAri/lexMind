'use client';

import { ReactNode } from 'react';
import Navigation from './Navigation';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function DashboardLayout({ 
  children, 
  title, 
  subtitle, 
  actions 
}: DashboardLayoutProps) {
  return (
    <div className="container-page">
      <Navigation />
      
      <main className="flex-1">
        {/* Page header */}
        {(title || subtitle || actions) && (
          <div className="bg-white/50 backdrop-blur-sm border-b border-secondary-200/50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between py-6">
                <div>
                  {title && (
                    <h1 className="text-2xl font-bold text-secondary-900">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-sm text-secondary-600">{subtitle}</p>
                  )}
                </div>
                {actions && (
                  <div className="flex items-center gap-3">
                    {actions}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}