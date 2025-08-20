'use client';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import Login from './Login';
import { Loader2 } from 'lucide-react';

function AuthenticatedApp({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}

export default function AuthWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </AuthProvider>
  );
}