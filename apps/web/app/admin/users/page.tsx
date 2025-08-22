'use client';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/lib/auth';
import { createApiClient } from '@/lib/api';

type User = {
  username: string;
  email?: string | null;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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

  return (
    <RoleGuard allowed={['admin']}>
      <DashboardLayout title="User Management" subtitle="Manage accounts and roles">
        <div className="card p-6">
          <div className="mb-4 flex justify-between items-center">
            <button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn btn-primary"
            >
              {showCreateForm ? 'Cancel' : 'Create User'}
            </button>
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

          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3">Username</th>
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Role</th>
                  <th className="text-left py-2 px-3">Active</th>
                  <th className="text-left py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username} className="border-t">
                    <td className="py-2 px-3">{u.username}</td>
                    <td className="py-2 px-3">{u.email || '-'}</td>
                    <td className="py-2 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.username, { role: e.target.value as User['role'] })}
                        className="input text-sm"
                      >
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={u.is_active}
                        onChange={(e) => updateUser(u.username, { is_active: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u.username)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}


