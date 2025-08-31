'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  Eye, 
  Edit,
  Crown,
  Shield,
  Clock,
  Send,
  X,
  Plus,
  AtSign,
  Bell,
  BellOff
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

export interface Collaborator {
  user_id: string;
  username: string;
  email?: string;
  role: 'owner' | 'editor' | 'viewer';
  permissions: {
    can_edit: boolean;
    can_comment: boolean;
    can_share: boolean;
    can_delete: boolean;
  };
  last_seen: string;
  is_online: boolean;
  cursor_position?: number;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  updated_at?: string;
  position?: number;
  replies?: Comment[];
  is_resolved: boolean;
}

interface CollaborationPanelProps {
  documentId: string;
  currentUser: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function CollaborationPanel({ 
  documentId, 
  currentUser, 
  isOpen,
  onToggle 
}: CollaborationPanelProps) {
  const { token } = useAuth();
  const api = React.useMemo(() => createApiClient(token), [token]);
  
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments'>('collaborators');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [newComment, setNewComment] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCollaborationData();
    }
  }, [isOpen, documentId]);

  const loadCollaborationData = async () => {
    try {
      setLoading(true);
      
      // Load collaborators
      const collabResponse = await api.request(`/api/v1/documents/${documentId}/collaborators`);
      if (collabResponse.ok) {
        const collabData = await collabResponse.json();
        setCollaborators(collabData.collaborators || []);
      }
      
      // Load comments
      const commentsResponse = await api.request(`/api/v1/documents/${documentId}/comments`);
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        setComments(commentsData.comments || []);
      }
    } catch (err) {
      console.error('Failed to load collaboration data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const response = await api.request(`/api/v1/documents/${documentId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          permissions: {
            can_edit: inviteRole === 'editor',
            can_comment: true,
            can_share: inviteRole === 'editor',
            can_delete: false
          }
        })
      });

      if (response.ok) {
        setInviteEmail('');
        setShowInviteForm(false);
        loadCollaborationData();
      }
    } catch (err) {
      console.error('Failed to invite collaborator:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await api.request(`/api/v1/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          author: currentUser
        })
      });

      if (response.ok) {
        setNewComment('');
        loadCollaborationData();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      const response = await api.request(`/api/v1/documents/${documentId}/collaborators/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadCollaborationData();
      }
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'editor': return <Edit className="h-4 w-4 text-blue-600" />;
      case 'viewer': return <Eye className="h-4 w-4 text-gray-600" />;
      default: return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Collaboration</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setNotifications(!notifications)}
              className={`p-2 rounded-lg transition-colors ${notifications ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
              title={notifications ? 'Disable notifications' : 'Enable notifications'}
            >
              {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            <button
              onClick={onToggle}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('collaborators')}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'collaborators' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>People</span>
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {collaborators.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'comments' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Comments</span>
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {comments.filter(c => !c.is_resolved).length}
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Collaborators Tab */}
            {activeTab === 'collaborators' && (
              <div className="p-4">
                {/* Invite Button */}
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  className="w-full flex items-center justify-center space-x-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors mb-4"
                >
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <span className="text-blue-600 font-medium">Invite people</span>
                </button>

                {/* Invite Form */}
                {showInviteForm && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <form onSubmit={handleInviteCollaborator}>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email address
                          </label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                          </label>
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="viewer">Viewer - can view and comment</option>
                            <option value="editor">Editor - can edit and share</option>
                          </select>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Send Invite
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowInviteForm(false)}
                            className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* Collaborators List */}
                <div className="space-y-3">
                  {collaborators.map((collaborator) => (
                    <div key={collaborator.user_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {collaborator.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {collaborator.is_online && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{collaborator.username}</span>
                            {getRoleIcon(collaborator.role)}
                          </div>
                          {collaborator.email && (
                            <p className="text-sm text-gray-600">{collaborator.email}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {collaborator.is_online ? 'Online' : `Last seen ${formatTimeAgo(collaborator.last_seen)}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(collaborator.role)}`}>
                          {collaborator.role}
                        </span>
                        {collaborator.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveCollaborator(collaborator.user_id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove collaborator"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="p-4">
                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="mb-4">
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <AtSign className="h-4 w-4" />
                        <span>@ to mention someone</span>
                      </div>
                      <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="h-4 w-4" />
                        <span>Comment</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <h4 className="text-lg font-medium text-gray-900 mb-1">No comments yet</h4>
                      <p className="text-gray-600">Start a discussion by adding the first comment.</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className={`p-3 rounded-lg ${comment.is_resolved ? 'bg-gray-50 opacity-75' : 'bg-white border border-gray-200'}`}>
                        <div className="flex items-start space-x-3">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-semibold text-xs">
                              {comment.author.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900">{comment.author}</span>
                              <span className="text-xs text-gray-500">{formatTimeAgo(comment.created_at)}</span>
                              {comment.is_resolved && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                  Resolved
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}