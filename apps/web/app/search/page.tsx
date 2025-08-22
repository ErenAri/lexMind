'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import AdvancedSearch from '@/components/AdvancedSearch';

export default function SearchPage() {
  return (
    <AuthWrapper>
      <DashboardLayout>
        <AdvancedSearch />
      </DashboardLayout>
    </AuthWrapper>
  );
}