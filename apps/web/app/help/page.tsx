'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  HelpCircle,
  MessageCircle,
  FileText,
  Search,
  Settings,
  Shield,
  BookOpen,
  Keyboard,
  Mail,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  const faqs = [
    {
      question: "How do I upload compliance documents?",
      answer: "Go to the Documents page and click 'Upload Document'. You can upload PDF files or paste text directly. The system will automatically process and index your documents for search and AI analysis."
    },
    {
      question: "How does the AI chat work?",
      answer: "The AI chat searches through your uploaded documents and regulations to provide informed answers. It uses local AI (Ollama) and shows sources for transparency. All processing happens offline for security."
    },
    {
      question: "What file formats are supported?",
      answer: "Currently, LexMind supports PDF files and plain text. The system extracts text content and creates searchable chunks for better retrieval."
    },
    {
      question: "How accurate are the AI responses?",
      answer: "The AI provides responses based on your uploaded documents and shows source citations. Always verify critical compliance information with the original documents. The AI is a tool to assist, not replace, professional judgment."
    },
    {
      question: "Is my data secure?",
      answer: "Yes! LexMind runs completely offline. Your documents, conversations, and data never leave your local environment. All AI processing happens on your machine using Ollama."
    },
    {
      question: "Can I export my data?",
      answer: "Yes, you can export your settings and data from the Settings page. This includes user preferences, notification settings, and other configuration data."
    }
  ];

  const shortcuts = [
    { key: 'Ctrl + K', action: 'Open search' },
    { key: 'Ctrl + N', action: 'New chat conversation' },
    { key: 'Ctrl + U', action: 'Upload document' },
    { key: 'Ctrl + D', action: 'Go to dashboard' },
    { key: 'Ctrl + ,', action: 'Open settings' },
    { key: 'Ctrl + ?', action: 'Open help (this page)' },
  ];

  return (
    <AuthWrapper>
      <DashboardLayout
        title="Help & Support"
        subtitle="Get help using LexMind and learn about its features"
        actions={
          <div className="flex items-center gap-3">
            <a
              href="mailto:support@lexmind.com"
              className="btn btn-outline flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Contact Support
            </a>
            <a
              href="https://docs.lexmind.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Documentation
            </a>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Quick Start Guide */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Quick Start Guide</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/documents"
                className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <FileText className="h-8 w-8 text-primary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 mb-2">1. Upload Documents</h4>
                <p className="text-sm text-secondary-600 mb-3">
                  Start by uploading your compliance documents and regulations.
                </p>
                <div className="flex items-center text-primary-600 group-hover:text-primary-700">
                  <span className="text-sm">Go to Documents</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              <Link
                href="/search"
                className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <Search className="h-8 w-8 text-primary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 mb-2">2. Search Content</h4>
                <p className="text-sm text-secondary-600 mb-3">
                  Use hybrid search to find specific regulations and document sections.
                </p>
                <div className="flex items-center text-primary-600 group-hover:text-primary-700">
                  <span className="text-sm">Try Search</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              <Link
                href="/chat"
                className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <MessageCircle className="h-8 w-8 text-primary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 mb-2">3. Ask Questions</h4>
                <p className="text-sm text-secondary-600 mb-3">
                  Chat with AI to get answers based on your uploaded documents.
                </p>
                <div className="flex items-center text-primary-600 group-hover:text-primary-700">
                  <span className="text-sm">Start Chatting</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              <Link
                href="/settings"
                className="p-4 border border-secondary-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors group"
              >
                <Settings className="h-8 w-8 text-primary-600 mb-3" />
                <h4 className="font-semibold text-secondary-900 mb-2">4. Customize</h4>
                <p className="text-sm text-secondary-600 mb-3">
                  Configure your preferences, notifications, and user settings.
                </p>
                <div className="flex items-center text-primary-600 group-hover:text-primary-700">
                  <span className="text-sm">Open Settings</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Frequently Asked Questions</h3>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details key={index} className="group">
                  <summary className="cursor-pointer p-4 bg-secondary-50 rounded-lg hover:bg-secondary-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-secondary-900">{faq.question}</h4>
                      <ChevronRight className="h-4 w-4 text-secondary-600 transform group-open:rotate-90 transition-transform" />
                    </div>
                  </summary>
                  <div className="mt-3 p-4 bg-white border border-secondary-200 rounded-lg">
                    <p className="text-secondary-700 leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Keyboard className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Keyboard Shortcuts</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                  <span className="text-secondary-700">{shortcut.action}</span>
                  <kbd className="px-2 py-1 bg-white rounded border text-xs font-mono text-secondary-600">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-sm text-primary-700">
                <strong>Note:</strong> Keyboard shortcuts can be enabled or disabled in your preferences.
              </p>
            </div>
          </div>

          {/* Feature Overview */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Key Features</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-secondary-900 mb-3">Security & Privacy</h4>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Complete offline operation
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Local AI processing with Ollama
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    No data leaves your environment
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Role-based access control
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-secondary-900 mb-3">AI Capabilities</h4>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Document-aware conversations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Source citation and transparency
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Hybrid search (full-text + vector)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Conversation history
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-secondary-900 mb-3">Document Management</h4>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    PDF and text upload
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Automatic indexing and chunking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Metadata and organization
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Preview and management tools
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-secondary-900 mb-3">User Experience</h4>
                <ul className="space-y-2 text-sm text-secondary-700">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Modern, responsive interface
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Customizable preferences
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Keyboard shortcuts
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                    Mobile-friendly design
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Support Contact */}
          <div className="card p-6 bg-primary-50 border border-primary-200">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">Need More Help?</h3>
            <p className="text-primary-700 mb-4">
              If you can't find the answer you're looking for, our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="mailto:support@lexmind.com"
                className="btn btn-primary flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Email Support
              </a>
              <a
                href="https://docs.lexmind.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Full Documentation
              </a>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  );
}