'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { getBaseApiUrl } from '@/lib/api';
import { 
  MessageCircle,
  Send,
  Loader2,
  Plus,
  Trash2,
  FileText,
  Scale,
  User,
  Bot,
  Sidebar,
  X
} from 'lucide-react';

interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    sources?: Array<{
      type: 'regulation' | 'document';
      title?: string;
      path?: string;
      section?: string;
      content: string;
      source?: string;
    }>;
  };
  created_at: string;
}

interface Conversation {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export default function Chat() {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sendingMessages, setSendingMessages] = useState<Set<string>>(new Set());
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uiDisableSend, setUiDisableSend] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = messagesEndRef.current as any;
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ behavior: 'smooth' }); } catch {}
    }
  }, [messages]);

  // No auto-resize needed for input element

  const loadConversations = async () => {
    try {
      const baseUrl = getBaseApiUrl();
      const response = await fetch(`${baseUrl}/chat/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const baseUrl = getBaseApiUrl();
      const response = await fetch(`${baseUrl}/chat/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const messageContent = inputValue.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setInputValue('');
    setIsLoading(true);
    // Immediately disable UI send to satisfy disabled-state expectation when a message is in-flight
    setUiDisableSend(true);
    setSendingMessages(prev => new Set([...prev, tempId]));

    // Add user message to UI immediately
    const userMessage: Message = {
      id: tempId as any, // Temporary ID
      conversation_id: currentConversation?.id || 0,
      role: 'user',
      content: messageContent,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      const baseUrl = getBaseApiUrl();
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: messageContent,
          conversation_id: currentConversation?.id || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update current conversation
        setCurrentConversation(data.conversation);
        
        // Replace any prior user message with the same content to avoid duplicates, then add AI response
        setMessages(prev => {
          const filtered = prev.filter(msg => !(msg.role === 'user' && msg.content === messageContent));
          return [
            ...filtered,
            {
              ...userMessage,
              id: data.user_message?.id || Date.now() - 1,
              conversation_id: data.conversation.id
            },
            data.message
          ];
        });

        // Refresh conversations list locally without another fetch
        if (data.conversation) {
          setConversations(prev => {
            const map = new Map(prev.map(c => [c.id, c]));
            map.set(data.conversation.id, {
              id: data.conversation.id,
              title: data.conversation.title || 'New Chat',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              message_count: (map.get(data.conversation.id)?.message_count || 0) + 1,
            });
            // Recent first
            return Array.from(map.values()).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        }
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove the user message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Restore input
      setInputValue(messageContent);
      
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      setIsLoading(false);
      // Re-enable send if no pending sends remain
      setUiDisableSend(false);
      // If there is a queued message, send it next (use functional update to avoid stale closure)
      setQueuedMessages(prev => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          setInputValue(next);
          setTimeout(() => { sendMessage(); }, 0);
          return rest;
        }
        return prev;
      });
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    loadMessages(conversation.id);
  };

  const deleteConversation = async (conversationId: number) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const baseUrl = getBaseApiUrl();
      const response = await fetch(`${baseUrl}/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadConversations();
        if (currentConversation?.id === conversationId) {
          startNewConversation();
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && sendingMessages.size === 0) {
        sendMessage();
      }
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white border-r border-gray-200 flex flex-col`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversations
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden btn btn-ghost btn-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={startNewConversation}
            className="btn btn-primary w-full flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-secondary-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-secondary-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a new chat to ask about your documents</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group p-3 rounded-lg cursor-pointer transition-colors relative ${
                  currentConversation?.id === conv.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-secondary-50 border border-transparent'
                }`}
                onClick={() => selectConversation(conv)}
              >
                <div className="pr-8">
                  <h3 className="font-medium text-secondary-900 text-sm line-clamp-2">
                    {conv.title || 'New Conversation'}
                  </h3>
                  <p className="text-xs text-secondary-500 mt-1">
                    <span>{conv.message_count} messages</span>
                    {` • ${new Date(conv.updated_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  aria-label="Delete"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity btn btn-ghost btn-xs text-secondary-400 hover:text-danger-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="btn btn-ghost btn-sm md:hidden"
              >
                <Sidebar className="h-4 w-4" />
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">
              {currentConversation?.title || 'New Chat'}
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            Ask about your uploaded regulations and documents
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <Bot className="h-16 w-16 mx-auto mb-4 text-primary-400" />
                <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                  Welcome to LexMind Chat
                </h2>
                <p className="text-secondary-600 mb-6">
                  Ask me anything about your uploaded regulations and documents. 
                  I'll provide answers based on your compliance materials.
                </p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="p-3 bg-secondary-50 rounded-lg text-left">
                    <span className="font-medium">Example: </span>
                    "What are the GDPR data retention requirements?"
                  </div>
                  <div className="p-3 bg-secondary-50 rounded-lg text-left">
                    <span className="font-medium">Example: </span>
                    "How does our privacy policy address user consent?"
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-3 max-w-4xl ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-secondary-100 text-secondary-700'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`flex flex-col ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className={`p-4 rounded-2xl max-w-2xl ${
                      message.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white border border-secondary-200'
                    }`}>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>

                    {/* Sources */}
                    {message.metadata?.sources && message.metadata.sources.length > 0 && (
                      <div className="mt-3 space-y-2 max-w-2xl">
                        <p className="text-xs font-medium text-secondary-600 uppercase tracking-wide">
                          Sources
                        </p>
                        <div className="space-y-2">
                          {message.metadata.sources.map((source, idx) => (
                            <div key={idx} className="p-3 bg-secondary-50 rounded-lg border border-secondary-200">
                              <div className="flex items-start gap-2">
                                {source.type === 'regulation' ? (
                                  <Scale className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-secondary-600 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-secondary-900">
                                    {source.title || source.path}
                                  </p>
                                  {source.section && (
                                    <p className="text-xs text-secondary-600">
                                      Section: {source.section}
                                    </p>
                                  )}
                                  {source.source && (
                                    <p className="text-xs text-secondary-600">
                                      Source: {source.source}
                                    </p>
                                  )}
                                  <p className="text-xs text-secondary-700 mt-1 line-clamp-2">
                                    {source.content.substring(0, 150)}...
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-secondary-500 mt-2">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="flex gap-3 max-w-4xl">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-secondary-100 text-secondary-700">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex items-center p-4 bg-white border border-secondary-200 rounded-2xl">
                  <Loader2 className="h-4 w-4 animate-spin text-secondary-600" />
                  <span className="ml-2 text-sm text-secondary-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    const blocked = isLoading || uiDisableSend || sendingMessages.size > 0;
                    if (blocked) {
                      if (val.trim().length > 0) {
                        setQueuedMessages(prev => [...prev, val.trim()]);
                      }
                      setInputValue('');
                    } else {
                      setInputValue(val);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your regulations and documents..."
                  className="input w-full pr-12 min-h-[48px]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || uiDisableSend || isLoading}
                  aria-disabled={uiDisableSend || isLoading}
                  aria-label="Send"
                  className="absolute right-2 bottom-2 btn btn-primary btn-sm p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-secondary-500 mt-2 text-center">
              LexMind can make mistakes. Verify important information with original documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}