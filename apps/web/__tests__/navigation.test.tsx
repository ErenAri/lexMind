/**
 * Navigation Tests
 * Tests for the SPA navigation fix
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardPage from '@/app/page';
import { useAuth } from '@/lib/auth';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth hook
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock other components to isolate navigation behavior
jest.mock('@/components/PageWrapper', () => {
  return function MockPageWrapper({ children }: { children: React.ReactNode }) {
    return <div data-testid="page-wrapper">{children}</div>;
  };
});

jest.mock('@/components/DashboardLayout', () => {
  return function MockDashboardLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="dashboard-layout">{children}</div>;
  };
});

jest.mock('@/components/ComplianceDashboard', () => {
  return function MockComplianceDashboard() {
    return <div data-testid="compliance-dashboard">Compliance Dashboard</div>;
  };
});

jest.mock('@/components/ui/StatsCard', () => {
  return function MockStatsCard(props: any) {
    return <div data-testid="stats-card">{props.title}</div>;
  };
});

jest.mock('@/components/ui/ComplianceCard', () => {
  return function MockComplianceCard(props: any) {
    return <div data-testid="compliance-card">{props.title}</div>;
  };
});

jest.mock('@/components/ui/SearchBar', () => {
  return function MockSearchBar({ onSearch }: { onSearch: (query: string) => void }) {
    return (
      <input 
        data-testid="search-bar" 
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search documents..."
      />
    );
  };
});

jest.mock('@/components/FindingsList', () => {
  return function MockFindingsList() {
    return <div data-testid="findings-list">Findings List</div>;
  };
});

jest.mock('@/components/CoveragePanel', () => {
  return function MockCoveragePanel() {
    return <div data-testid="coverage-panel">Coverage Panel</div>;
  };
});

jest.mock('@/components/DocumentUpload', () => {
  return function MockDocumentUpload() {
    return <div data-testid="document-upload">Document Upload</div>;
  };
});

jest.mock('@/components/RoleGuard', () => {
  return function MockRoleGuard({ children }: { children: React.ReactNode }) {
    return <div data-testid="role-guard">{children}</div>;
  };
});

describe('Dashboard Navigation', () => {
  const mockPush = jest.fn();
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });

    mockUseAuth.mockReturnValue({
      user: { username: 'testuser', role: 'analyst' },
      token: 'test-token',
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    });

    // Mock fetch for API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_documents: 100,
        average_score: 85,
        analyzed_documents: 90,
        risk_distribution: { high: 5, critical: 2 },
      }),
    });
  });

  test('should use router.push for Advanced Search navigation', async () => {
    render(<DashboardPage />);

    // Wait for component to render and find the Advanced Search button
    await waitFor(() => {
      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    });

    const advancedSearchButton = screen.getByText('Advanced Search');
    fireEvent.click(advancedSearchButton);

    expect(mockPush).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test('should use router.push for Ask AI navigation', async () => {
    render(<DashboardPage />);

    // Wait for component to render and find the Ask AI button
    await waitFor(() => {
      expect(screen.getByText('Ask AI')).toBeInTheDocument();
    });

    const askAiButton = screen.getByText('Ask AI');
    fireEvent.click(askAiButton);

    expect(mockPush).toHaveBeenCalledWith('/chat');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test('should not use window.location.href for navigation', async () => {
    // Mock window.location to ensure it's not used
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' };

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    });

    const advancedSearchButton = screen.getByText('Advanced Search');
    fireEvent.click(advancedSearchButton);

    // Verify that window.location.href was not changed
    expect(window.location.href).toBe('');
    
    // Restore original location
    window.location = originalLocation;
  });

  test('should handle navigation errors gracefully', async () => {
    // Make router.push throw an error
    mockPush.mockImplementationOnce(() => {
      throw new Error('Navigation failed');
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    });

    const advancedSearchButton = screen.getByText('Advanced Search');
    
    // This should not throw an unhandled error
    expect(() => {
      fireEvent.click(advancedSearchButton);
    }).not.toThrow();

    consoleSpy.mockRestore();
  });
});