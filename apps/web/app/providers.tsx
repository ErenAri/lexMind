'use client';
import { ReactNode } from 'react';
import AuthWrapper from '../components/AuthWrapper';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthWrapper>
      <div className="container-page">
        {children}
      </div>
    </AuthWrapper>
  );
}


