'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { 
  Shield, 
  Search, 
  FileText, 
  BarChart3, 
  Settings, 
  User, 
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  Bell,
  HelpCircle
} from 'lucide-react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3, current: true },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and primary nav */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-xl font-bold text-gradient">LexMind</div>
            </Link>
            
            {/* Desktop navigation */}
            <div className="hidden md:ml-10 md:flex md:space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${item.current 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Search bar - hidden on mobile */}
          <div className="hidden md:block md:flex-1 md:max-w-xs md:ml-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-secondary-400" />
              </div>
              <input
                type="text"
                placeholder="Search regulations, documents..."
                className="input pl-10 w-full text-sm"
              />
            </div>
          </div>

          {/* Right side items */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="btn btn-ghost btn-sm relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger-500"></span>
            </button>

            {/* Help */}
            <button className="btn btn-ghost btn-sm">
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary-700 hover:bg-secondary-100 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium">{user.username}</div>
                  <div className="text-xs text-secondary-500 capitalize">{user.role}</div>
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* User dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 card-elevated py-1 z-50">
                  <div className="px-4 py-2 border-b border-secondary-200">
                    <div className="text-sm font-medium text-secondary-900">{user.username}</div>
                    <div className="text-xs text-secondary-500">{user.email}</div>
                    <div className="inline-flex items-center gap-1 mt-1">
                      <span className="badge badge-primary">{user.role}</span>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100"
                  >
                    Profile Settings
                  </Link>
                  <Link
                    href="/preferences"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100"
                  >
                    Preferences
                  </Link>
                  <hr className="my-1 border-secondary-200" />
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-danger-700 hover:bg-danger-50"
                  >
                    <LogOut className="inline h-4 w-4 mr-2" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden btn btn-ghost btn-sm"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-secondary-200 pt-4 pb-3 space-y-1">
            {/* Mobile search */}
            <div className="px-3 pb-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-secondary-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="input pl-10 w-full text-sm"
                />
              </div>
            </div>

            {/* Mobile navigation */}
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 text-base font-medium transition-colors
                    ${item.current 
                      ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600' 
                      : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Click outside to close user menu */}
      {isUserMenuOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </nav>
  );
}