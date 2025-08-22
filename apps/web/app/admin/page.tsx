'use client';

import { useState, useEffect } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/lib/auth';
import { 
  Users,
  Shield,
  Database,
  Activity,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  UserCheck,
  UserX,
  Crown,
  Eye
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'analyst' | 'viewer'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer' as 'viewer' | 'analyst' | 'admin'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/v1/auth/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        await loadUsers();
        setShowCreateModal(false);
        setNewUser({ username: '', email: '', password: '', role: 'viewer' });
      } else {
        alert('Failed to create user');
      }
    } catch (error) {
      alert('Failed to create user');
    }
  };

  const updateUser = async (username: string, updates: Partial<User>) => {
    try {
      const response = await fetch(`/api/v1/auth/users/${username}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadUsers();
        setEditingUser(null);
      } else {
        alert('Failed to update user');
      }
    } catch (error) {
      alert('Failed to update user');
    }
  };

  const deleteUser = async (username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      const response = await fetch(`/api/v1/auth/users/${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await loadUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-danger';
      case 'analyst': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'analyst': return Shield;
      default: return Eye;
    }
  };

  if (!currentUser) return null;

  return (
    <AuthWrapper>
      <RoleGuard allowedRoles={['admin']}>
        <DashboardLayout
          title="User Management"
          subtitle="Manage users, roles, and permissions"
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadUsers()}
                className="btn btn-outline flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Users
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add User
              </button>
            </div>
          }
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-600">Total Users</p>
                  <p className="text-2xl font-bold text-secondary-900">{users.length}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-success-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-600">Active Users</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {users.filter(u => u.is_active).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-danger-100 rounded-lg flex items-center justify-center">
                  <Crown className="h-6 w-6 text-danger-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-600">Administrators</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-warning-600" />
                </div>
                <div>
                  <p className="text-sm text-secondary-600">Analysts</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {users.filter(u => u.role === 'analyst').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-secondary-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search users by username or email..."
                  className="input pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="input w-full md:w-auto"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="analyst">Analysts</option>
                <option value="viewer">Viewers</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary-50 border-b border-secondary-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-secondary-900">User</th>
                    <th className="text-left p-4 font-medium text-secondary-900">Role</th>
                    <th className="text-left p-4 font-medium text-secondary-900">Status</th>
                    <th className="text-left p-4 font-medium text-secondary-900">Last Login</th>
                    <th className="text-left p-4 font-medium text-secondary-900">Created</th>
                    <th className="text-right p-4 font-medium text-secondary-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-secondary-600">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-secondary-600">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);
                      return (
                        <tr key={user.id} className="hover:bg-secondary-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-secondary-900">
                                  {user.username}
                                  {user.username === currentUser.username && (
                                    <span className="ml-2 text-xs text-primary-600">(You)</span>
                                  )}
                                </div>
                                <div className="text-sm text-secondary-600">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-4 w-4 text-secondary-600" />
                              <span className={`badge ${getRoleBadgeColor(user.role)}`}>
                                {user.role.toUpperCase()}
                              </span>
                            </div>
                          </td>
                          
                          <td className="p-4">
                            <span className={`badge ${
                              user.is_active ? 'badge-success' : 'badge-secondary'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          
                          <td className="p-4 text-sm text-secondary-600">
                            {user.last_login 
                              ? new Date(user.last_login).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                          
                          <td className="p-4 text-sm text-secondary-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingUser(user)}
                                className="btn btn-ghost btn-sm"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => updateUser(user.username, { is_active: !user.is_active })}
                                className="btn btn-ghost btn-sm"
                              >
                                {user.is_active ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </button>
                              
                              {user.username !== currentUser.username && (
                                <button
                                  onClick={() => deleteUser(user.username)}
                                  className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create User Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">Create New User</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                      className="input w-full"
                      placeholder="Enter username"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      className="input w-full"
                      placeholder="Enter email"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      className="input w-full"
                      placeholder="Enter password"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
                      className="input w-full"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="analyst">Analyst</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createUser}
                    className="btn btn-primary"
                  >
                    Create User
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                  Edit User: {editingUser.username}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                      className="input w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Role
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, role: e.target.value as any }) : null)}
                      className="input w-full"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="analyst">Analyst</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Active Status</h4>
                      <p className="text-sm text-secondary-600">User can log in and access the system</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.is_active}
                        onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, is_active: e.target.checked }) : null)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateUser(editingUser.username, {
                      email: editingUser.email,
                      role: editingUser.role,
                      is_active: editingUser.is_active
                    })}
                    className="btn btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </DashboardLayout>
      </RoleGuard>
    </AuthWrapper>
  );
}