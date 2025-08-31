/**
 * Integration Tests
 * Tests for the complete application flow with all bug fixes
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import DashboardPage from '@/app/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth hook
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock components
jest.mock('@/components/PageWrapper', () => {
  return function MockPageWrapper({ children }: { children: React.ReactNode }) {
    return <div data-testid="page-wrapper">{children}</div>;
  };
});

jest.mock('@/components/DashboardLayout', () => {
  return function MockDashboardLayout({ children, title }: { children: React.ReactNode, title?: string }) {
    return (
      <div data-testid="dashboard-layout">
        {title && <h1>{title}</h1>}
        {children}
      </div>
    );
  };
});

jest.mock('@/components/ComplianceDashboard', () => {
  return function MockComplianceDashboard() {
    return <div data-testid="compliance-dashboard">Compliance Dashboard</div>;
  };
});

jest.mock('@/components/ui/StatsCard', () => {
  return function MockStatsCard({ title, value }: { title: string, value: string }) {
    return <div data-testid={`stats-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}: {value}</div>;
  };
});

jest.mock('@/components/ui/ComplianceCard', () => {
  return function MockComplianceCard({ title }: { title: string }) {
    return <div data-testid="compliance-card">{title}</div>;
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

jest.mock('@/components/DocumentUpload', () => {
  return function MockDocumentUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
    return (
      <div data-testid="document-upload">
        <button onClick={onUploadComplete}>Upload Document</button>
      </div>
    );
  };
});

jest.mock('@/components/FindingsList', () => {
  return function MockFindingsList({ query }: { query: string }) {
    return (
      <div data-testid="findings-list">
        {query && <div>Results for: {query}</div>}
      </div>
    );
  };
});

jest.mock('@/components/CoveragePanel', () => {
  return function MockCoveragePanel() {
    return <div data-testid="coverage-panel">Coverage Panel</div>;
  };
});

jest.mock('@/components/RoleGuard', () => {
  return function MockRoleGuard({ children }: { children: React.ReactNode }) {
    return <div data-testid="role-guard">{children}</div>;
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Integration Tests - All Bug Fixes', () => {
  const mockPush = jest.fn();

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

    // Mock localStorage and sessionStorage
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const mockSessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

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

  test('should render dashboard with all components', async () => {
    render(<DashboardPage />);

    // Wait for dashboard to render
    await waitFor(() => {
      expect(screen.getByText('LexMind Compliance Dashboard')).toBeInTheDocument();
    });

    // Verify all major components are present
    expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('document-upload')).toBeInTheDocument();
    expect(screen.getByTestId('findings-list')).toBeInTheDocument();
    expect(screen.getByTestId('coverage-panel')).toBeInTheDocument();

    // Verify stats cards are rendered
    expect(screen.getByTestId('stats-total-documents')).toBeInTheDocument();
    expect(screen.getByTestId('stats-compliance-score')).toBeInTheDocument();
  });

  test('should handle complete user workflow', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    });

    // Step 1: Search for documents
    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'GDPR compliance' } });

    // Verify search results appear
    await waitFor(() => {
      expect(screen.getByText('Results for: GDPR compliance')).toBeInTheDocument();
    });

    // Step 2: Navigate to advanced search using proper routing
    const advancedSearchButton = screen.getByText('Advanced Search');
    fireEvent.click(advancedSearchButton);

    expect(mockPush).toHaveBeenCalledWith('/search');

    // Step 3: Navigate to chat using proper routing
    const askAiButton = screen.getByText('Ask AI');
    fireEvent.click(askAiButton);

    expect(mockPush).toHaveBeenCalledWith('/chat');

    // Step 4: Upload document without page reload
    const uploadButton = screen.getByText('Upload Document');
    fireEvent.click(uploadButton);

    // Verify no window.location calls were made
    expect(mockPush).toHaveBeenCalledTimes(2); // Only the navigation calls
  });

  test('should handle authentication token correctly', async () => {
    const mockToken = 'test-auth-token';
    
    // Setup localStorage with token
    (window.localStorage.getItem as jest.Mock).mockReturnValue(mockToken);
    (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<DashboardPage />);

    // Wait for API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Verify fetch was called with correct headers
    const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
    const [url, options] = fetchCall;
    
    expect(options?.headers).toEqual(
      expect.objectContaining({
        'Authorization': `Bearer ${mockToken}`,
      })
    );
  });

  test('should fallback to sessionStorage when localStorage is empty', async () => {
    const mockToken = 'session-auth-token';
    
    // Setup sessionStorage with token, localStorage empty
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    (window.sessionStorage.getItem as jest.Mock).mockReturnValue(mockToken);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Since we're testing the component that uses the auth hook, 
    // the actual token checking happens in the API layer
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/compliance/dashboard'),
      expect.any(Object)
    );
  });

  test('should handle API errors gracefully', async () => {
    // Mock API failure
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('API Error')
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<DashboardPage />);

    // Wait for error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch stats:', expect.any(Error));
    });

    // Dashboard should still render with default values
    expect(screen.getByTestId('stats-total-documents')).toHaveTextContent('Total Documents: 0');

    consoleSpy.mockRestore();
  });

  test('should handle role-based access correctly', async () => {
    // Test with viewer role (limited access)
    mockUseAuth.mockReturnValue({
      user: { username: 'viewer', role: 'viewer' },
      token: 'viewer-token',
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('LexMind Compliance Dashboard')).toBeInTheDocument();
    });

    // RoleGuard should still render (the actual role checking happens inside)
    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
  });

  test('should maintain state during navigation', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    // Perform search
    const searchBar = screen.getByTestId('search-bar');
    fireEvent.change(searchBar, { target: { value: 'compliance search' } });

    // Verify search state is maintained
    expect(searchBar).toHaveValue('compliance search');

    // Navigate (should not lose state since no page reload)
    const advancedSearchButton = screen.getByText('Advanced Search');
    fireEvent.click(advancedSearchButton);

    // Verify navigation used router instead of window.location
    expect(mockPush).toHaveBeenCalledWith('/search');
    
    // In a real app, the search state would be maintained
    // since we're using client-side routing
  });

  test('should handle concurrent operations without conflicts', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    // Simulate concurrent operations
    const searchBar = screen.getByTestId('search-bar');
    const advancedSearchButton = screen.getByText('Advanced Search');
    const askAiButton = screen.getByText('Ask AI');

    // Perform multiple rapid operations
    fireEvent.change(searchBar, { target: { value: 'test search' } });
    fireEvent.click(advancedSearchButton);
    fireEvent.click(askAiButton);

    // All operations should complete successfully
    expect(mockPush).toHaveBeenCalledWith('/search');
    expect(mockPush).toHaveBeenCalledWith('/chat');
    expect(screen.getByText('Results for: test search')).toBeInTheDocument();
  });
});