'use client';

import React, { useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import Chat from '@/components/Chat';
import AIAssistant from '@/components/AIAssistant';
import { 
  MessageSquare,
  Sparkles,
  BookOpen,
  FileText,
  Bot
} from 'lucide-react';

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'ai-assistant'>('chat');

  const tabs = [
    { key: 'chat', label: 'Chat', icon: MessageSquare },
    { key: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
  ];

  return (
    <AuthWrapper>
      <DashboardLayout
        title="AI Chat & Assistant"
        subtitle="Interactive AI-powered compliance assistance and document analysis"
        actions={
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">AI-powered compliance help</span>
          </div>
        }
      >
        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'chat' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Interactive Chat</h2>
                    <p className="text-sm text-gray-600">
                      Ask questions about compliance, regulations, and documents
                    </p>
                  </div>
                </div>
              </div>
              <Chat />
            </div>
          )}

          {activeTab === 'ai-assistant' && (
            <div>
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">AI Compliance Assistant</h3>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  Compare regulations with documents to get explanations and remediation plans
                </p>
                <div className="mt-3 flex items-center space-x-6 text-sm text-blue-600">
                  <div className="flex items-center space-x-1">
                    <BookOpen className="h-4 w-4" />
                    <span>Regulation Analysis</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>Document Comparison</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Bot className="h-4 w-4" />
                    <span>AI-Powered Insights</span>
                  </div>
                </div>
              </div>
              
              <AIAssistant embedded />
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthWrapper>
  );
}