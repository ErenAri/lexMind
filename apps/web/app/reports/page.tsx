'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import ExportReports from '@/components/ExportReports';

export default function ReportsPage() {
  return (
    <AuthWrapper>
      <DashboardLayout>
        <ExportReports />
      </DashboardLayout>
    </AuthWrapper>
  );
}