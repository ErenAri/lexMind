"use client";
import { useAuth } from '@/lib/auth';

export type Role = 'viewer'|'analyst'|'admin';

export default function RoleGuard({ children, allowed }: { children: React.ReactNode; allowed: Role[] }) {
  const { user } = useAuth();
  
  if (!user || !allowed.includes(user.role)) return null;
  return <>{children}</>;
}


