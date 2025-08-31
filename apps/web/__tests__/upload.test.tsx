/**
 * Document Upload Tests
 * Tests for the upload error recovery and retry functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUpload from '@/components/DocumentUpload';
import { fetchJson } from '@/lib/api';

// Mock the API function
jest.mock('@/lib/api', () => ({
  fetchJson: jest.fn(),
}));

const mockFetchJson = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('DocumentUpload Error Recovery', () => {
  const mockOnUploadComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variable
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
    
    // Mock FileReader
    const mockFileReader = {
      readAsText: jest.fn(),
      result: 'test file content',
      onload: null as any,
      onerror: null as any,
    };
    
    global.FileReader = jest.fn().mockImplementation(() => mockFileReader);
    
    // Mock fetch for PDF uploads
    global.fetch = jest.fn();
  });

  test('should show retry button when upload fails', async () => {
    // Mock failed upload
    mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    // Create a test file
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;

    // Trigger file selection
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(input);

    // Wait for file to be processed and type selection to appear
    await waitFor(() => {
      expect(screen.getByText('Select document type:')).toBeInTheDocument();
    });

    // Select document type
    const docButton = screen.getByText('Company Doc');
    fireEvent.click(docButton);

    // Wait for ready state
    await waitFor(() => {
      expect(screen.getByText('Ready to upload')).toBeInTheDocument();
    });

    // Trigger upload
    const uploadButton = screen.getByText(/upload 1 file/i);
    fireEvent.click(uploadButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Verify retry button appears
    expect(screen.getByText('Retry upload')).toBeInTheDocument();
  });

  test('should retry failed upload when retry button is clicked', async () => {
    // First call fails, second succeeds
    mockFetchJson
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true });

    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Select document type:')).toBeInTheDocument();
    });

    const docButton = screen.getByText('Company Doc');
    fireEvent.click(docButton);

    await waitFor(() => {
      expect(screen.getByText('Ready to upload')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText(/upload 1 file/i);
    fireEvent.click(uploadButton);

    // Wait for error and retry button
    await waitFor(() => {
      expect(screen.getByText('Retry upload')).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText('Retry upload');
    fireEvent.click(retryButton);

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument();
    });

    // Verify the upload was called twice (original + retry)
    expect(mockFetchJson).toHaveBeenCalledTimes(2);
    expect(mockOnUploadComplete).toHaveBeenCalled();
  });

  test('should handle file size validation', async () => {
    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;

    // Mock alert
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(input);

    // Should show size error
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('too large. Maximum size is 10MB')
    );

    alertSpy.mockRestore();
  });

  test('should handle unsupported file types', async () => {
    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    const unsupportedFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    Object.defineProperty(input, 'files', {
      value: [unsupportedFile],
      writable: false,
    });
    
    fireEvent.change(input);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('not supported')
    );

    alertSpy.mockRestore();
  });

  test('should handle PDF uploads differently', async () => {
    const mockFormData = { append: jest.fn() };
    global.FormData = jest.fn().mockImplementation(() => mockFormData);

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response);

    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [pdfFile],
      writable: false,
    });
    
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('Select document type:')).toBeInTheDocument();
    });

    const docButton = screen.getByText('Company Doc');
    fireEvent.click(docButton);

    await waitFor(() => {
      expect(screen.getByText('Ready to upload')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText(/upload 1 file/i);
    fireEvent.click(uploadButton);

    // Verify PDF upload uses FormData and different endpoint
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ingest/pdf',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(Object), // FormData instance
        })
      );
    });
  });

  test('should limit maximum number of files', async () => {
    render(<DocumentUpload onUploadComplete={mockOnUploadComplete} />);

    // Create 11 files (exceeds limit of 10)
    const files = Array.from({ length: 11 }, (_, i) => 
      new File([`content ${i}`], `test${i}.txt`, { type: 'text/plain' })
    );
    
    const input = screen.getByLabelText(/choose files/i) as HTMLInputElement;
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    Object.defineProperty(input, 'files', {
      value: files,
      writable: false,
    });
    
    fireEvent.change(input);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Maximum 10 files allowed')
    );

    alertSpy.mockRestore();
  });
});