'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import DocumentComparison from '@/components/DocumentComparison';

export default function ComparePage() {
  return (
    <AuthWrapper>
      <DashboardLayout>
        <DocumentComparison />
      </DashboardLayout>
    </AuthWrapper>
  );
}