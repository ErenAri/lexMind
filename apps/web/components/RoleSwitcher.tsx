"use client";
import { useAuth } from '@/lib/auth';
import { LogOut, User } from 'lucide-react';

export default function RoleSwitcher() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        <User className="h-4 w-4" />
        <span className="font-medium">{user.username}</span>
        <span className="bg-neutral-100 px-2 py-1 rounded text-xs capitalize">
          {user.role}
        </span>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-800 px-2 py-1 rounded hover:bg-neutral-100 transition"
      >
        <LogOut className="h-3 w-3" />
        Logout
      </button>
    </div>
  );
}


