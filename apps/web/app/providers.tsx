'use client';
import { ReactNode } from 'react';
import AuthWrapper from '../components/AuthWrapper';
import NotificationProvider from '../components/notifications/NotificationProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthWrapper>
      <NotificationProvider>
        <div className="container-page">
          {children}
        </div>
      </NotificationProvider>
    </AuthWrapper>
  );
}


