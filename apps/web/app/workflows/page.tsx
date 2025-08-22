'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import WorkflowAutomation from '@/components/WorkflowAutomation';

export default function WorkflowsPage() {
  return (
    <AuthWrapper>
      <DashboardLayout>
        <WorkflowAutomation />
      </DashboardLayout>
    </AuthWrapper>
  );
}