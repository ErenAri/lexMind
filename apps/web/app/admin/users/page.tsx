'use client';
import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';
import { CardLoadingSkeleton } from '@/components/LoadingStates';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical,
  Shield,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  Mail,
  Key,
  Activity
} from 'lucide-react';

type User = {
  username: string;
  email?: string | null;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
  created_at?: string;
  last_login?: string;
};

type CreateUserData = {
  username: string;
  email: string;
  password: string;
  role: 'viewer' | 'analyst' | 'admin';
};

export default function UsersAdminPage() {
  const { token } = useAuth();
  const api = useMemo(() => createApiClient(token), [token]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'viewer' | 'analyst' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    role: 'viewer'
  });
  const [createLoading, setCreateLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.request('/auth/users');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setUsers(json);
    } catch (e: any) {
      setError(`Failed to load users: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(query) ||
        (user.email && user.email.toLowerCase().includes(query))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter, statusFilter]);

  const updateUser = async (username: string, body: Partial<Pick<User, 'role' | 'is_active' | 'email'>>) => {
    try {
      const res = await api.request(`/auth/users/${encodeURIComponent(username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await load();
    } catch (e) {
      console.error('Failed to update', e);
      alert('Update failed');
    }
  };

  const deleteUser = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      const res = await api.request(`/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`${res.status}`);
      await load();
    } catch (e) {
      console.error('Failed to delete', e);
      alert('Delete failed');
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await api.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createUserData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }
      await load();
      setShowCreateForm(false);
      setCreateUserData({ username: '', email: '', password: '', role: 'viewer' });
    } catch (e: any) {
      console.error('Failed to create user', e);
      alert(`Create user failed: ${e.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-red-600" />
      case 'analyst': return <Eye className="h-4 w-4 text-blue-600" />
      case 'viewer': return <Users className="h-4 w-4 text-gray-600" />
      default: return <Users className="h-4 w-4 text-gray-600" />
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      analyst: 'bg-blue-100 text-blue-800', 
      viewer: 'bg-gray-100 text-gray-800'
    };
    return `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[role as keyof typeof colors] || colors.viewer}`;
  };

  return (
    <RoleGuard allowed={['admin']}>
      <DashboardLayout 
        title="User Management" 
        subtitle="Manage user accounts, roles, and permissions"
        actions={
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{filteredUsers.length} of {users.length} users</span>
            </div>
            <button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>{showCreateForm ? 'Cancel' : 'Add User'}</span>
            </button>
          </div>
        }
      >
        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

          {showCreateForm && (
            <div className="card p-4 mb-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Create New User</h3>
              <form onSubmit={createUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      value={createUserData.username}
                      onChange={(e) => setCreateUserData({...createUserData, username: e.target.value})}
                      className="input w-full"
                      placeholder="Enter username"
                      minLength={3}
                      maxLength={50}
                      pattern="^[a-zA-Z0-9_.-]+$"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={createUserData.email}
                      onChange={(e) => setCreateUserData({...createUserData, email: e.target.value})}
                      className="input w-full"
                      placeholder="Enter email (optional)"
                      maxLength={255}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({...createUserData, password: e.target.value})}
                      className="input w-full"
                      placeholder="Enter password"
                      minLength={6}
                      maxLength={128}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      value={createUserData.role}
                      onChange={(e) => setCreateUserData({...createUserData, role: e.target.value as 'viewer' | 'analyst' | 'admin'})}
                      className="input w-full"
                    >
                      <option value="viewer">viewer</option>
                      <option value="analyst">analyst</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={createLoading}
                    className="btn btn-primary"
                  >
                    {createLoading ? 'Creating...' : 'Create User'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateForm(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <CardLoadingSkeleton count={5} height="h-16" />
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">Error Loading Users</p>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-6 gap-4 font-semibold text-sm text-gray-700">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>User</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Role</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4" />
                    <span>Status</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Last Login</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MoreVertical className="h-4 w-4" />
                    <span>Actions</span>
                  </div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-600">
                      {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filters' 
                        : 'No users have been created yet'}
                    </p>
                  </div>
                ) : (
                  filteredUsers.map(u => (
                    <div key={u.username} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="grid grid-cols-6 gap-4 items-center">
                        
                        {/* User Info */}
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{u.username}</div>
                            {u.created_at && (
                              <div className="text-xs text-gray-500">
                                Joined {new Date(u.created_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Email */}
                        <div className="text-sm">
                          {u.email ? (
                            <span className="text-gray-700">{u.email}</span>
                          ) : (
                            <span className="text-gray-400 italic">No email</span>
                          )}
                        </div>

                        {/* Role */}
                        <div>
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(u.role)}
                            <select
                              value={u.role}
                              onChange={(e) => updateUser(u.username, { role: e.target.value as User['role'] })}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="analyst">Analyst</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={u.is_active}
                              onChange={(e) => updateUser(u.username, { is_active: e.target.checked })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex items-center space-x-2">
                              {u.is_active ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm text-green-700 font-medium">Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <span className="text-sm text-red-700 font-medium">Inactive</span>
                                </>
                              )}
                            </div>
                          </label>
                        </div>

                        {/* Last Login */}
                        <div className="text-sm text-gray-600">
                          {u.last_login ? (
                            <span>{new Date(u.last_login).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-gray-400 italic">Never</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => deleteUser(u.username)}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}


