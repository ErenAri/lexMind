/**
 * Chat Race Condition Tests
 * Tests for the chat message race condition fix
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chat from '@/components/Chat';
import { useAuth } from '@/lib/auth';

// Mock auth hook
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Chat Message Race Conditions', () => {
  const mockUser = {
    username: 'testuser',
    role: 'analyst' as const,
    email: 'test@example.com',
    is_active: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'test-token',
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    });

    // Mock environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  });

  test('should handle rapid message sending without duplicates', async () => {
    let responseDelay = 100;
    
    // Mock fetch with controlled timing
    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        // First call for conversations
        Promise.resolve({
          ok: true,
          json: async () => [],
        })
      )
      .mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                conversation: { id: 1, title: 'Test Chat' },
                message: {
                  id: Date.now(),
                  role: 'assistant',
                  content: 'AI response',
                  conversation_id: 1,
                  created_at: new Date().toISOString(),
                },
                user_message: {
                  id: Date.now() - 1,
                  role: 'user',
                  conversation_id: 1,
                }
              }),
            });
          }, responseDelay);
          responseDelay += 50; // Stagger responses
        })
      );

    render(<Chat />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your regulations/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about your regulations/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send multiple messages rapidly
    fireEvent.change(input, { target: { value: 'First message' } });
    fireEvent.click(sendButton);

    // Don't wait, send another immediately
    fireEvent.change(input, { target: { value: 'Second message' } });
    fireEvent.click(sendButton);

    fireEvent.change(input, { target: { value: 'Third message' } });
    fireEvent.click(sendButton);

    // Wait until conversation reflects 3 messages processed
    await waitFor(() => {
      expect(screen.getByText('3 messages')).toBeInTheDocument();
    }, { timeout: 8000 });

    // Ensure the first message is not duplicated in the final render state
    await waitFor(() => {
      const firstMessages = screen.getAllByText('First message');
      expect(firstMessages).toHaveLength(1);
    }, { timeout: 2000 });
  }, 10000);

  test('should handle message send failure correctly', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => [],
        })
      )
      .mockImplementationOnce(() => 
        Promise.reject(new Error('Network error'))
      );

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your regulations/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about your regulations/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send a message that will fail
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    // Wait for error handling
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to send message. Please try again.');
    });

    // Verify message was removed from UI after failure
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    
    // Verify input was restored
    expect(input).toHaveValue('Test message');

    alertSpy.mockRestore();
  });

  test('should prevent sending while another message is being sent', async () => {
    let resolveFirst: (value: any) => void;
    
    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => [],
        })
      )
      .mockImplementationOnce(() => 
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your regulations/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about your regulations/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Send first message
    fireEvent.change(input, { target: { value: 'First message' } });
    fireEvent.click(sendButton);

    // Try to send second message while first is pending
    fireEvent.change(input, { target: { value: 'Second message' } });
    
    // The send button should be disabled or the action should be ignored
    expect(sendButton).toBeDisabled();

    // Resolve first message
    resolveFirst!({
      ok: true,
      json: async () => ({
        conversation: { id: 1, title: 'Test Chat' },
        message: {
          id: 2,
          role: 'assistant',
          content: 'AI response',
          conversation_id: 1,
          created_at: new Date().toISOString(),
        },
      }),
    });

    // Wait for first message to complete
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
  });

  test('should handle conversation loading correctly', async () => {
    const mockConversations = [
      {
        id: 1,
        title: 'Previous Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 5,
      },
    ];

    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => mockConversations,
        })
      );

    render(<Chat />);

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Previous Chat')).toBeInTheDocument();
    });

    expect(screen.getByText('5 messages')).toBeInTheDocument();
  });

  test('should handle conversation deletion correctly', async () => {
    const mockConversations = [
      {
        id: 1,
        title: 'Chat to Delete',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 3,
      },
    ];

    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => mockConversations,
        })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({ ok: true })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => [], // Empty after deletion
        })
      );

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Chat />);

    // Wait for conversation to load
    await waitFor(() => {
      expect(screen.getByText('Chat to Delete')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(screen.queryByText('Chat to Delete')).not.toBeInTheDocument();
    });

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this conversation?');
    
    confirmSpy.mockRestore();
  });

  test('should handle Enter key for message sending', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => [],
        })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: async () => ({
            conversation: { id: 1, title: 'New Chat' },
            message: {
              id: 1,
              role: 'assistant',
              content: 'AI response',
              conversation_id: 1,
              created_at: new Date().toISOString(),
            },
          }),
        })
      );

    render(<Chat />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about your regulations/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about your regulations/i);

    // Type message and press Enter
    fireEvent.change(input, { target: { value: 'Hello via Enter key' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Wait for message to appear
    await waitFor(() => {
      expect(screen.getByText('Hello via Enter key')).toBeInTheDocument();
    });

    // Verify Shift+Enter doesn't send the message
    fireEvent.change(input, { target: { value: 'Line 1\nLine 2' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

    // Should not trigger another API call
    expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load + previous send
  });
});