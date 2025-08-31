'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import NotificationBell from './notifications/NotificationBell';
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
  HelpCircle,
  MessageCircle,
  GitCompare,
  Download,
  Zap
} from 'lucide-react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3, current: currentPath === '/' },
    { name: 'Chat', href: '/chat', icon: MessageCircle, current: currentPath === '/chat' },
    { name: 'Documents', href: '/documents', icon: FileText, current: currentPath === '/documents' },
    { name: 'Compare', href: '/compare', icon: GitCompare, current: currentPath === '/compare' },
    { name: 'Workflows', href: '/workflows', icon: Zap, current: currentPath === '/workflows' },
    { name: 'Reports', href: '/reports', icon: Download, current: currentPath === '/reports' },
    { name: 'Search', href: '/search', icon: Search, current: currentPath === '/search' },
    { name: 'Agent', href: '/agent', icon: Zap, current: currentPath === '/agent' },
    { name: 'Settings', href: '/settings', icon: Settings, current: currentPath === '/settings' },
  ];

  if (!user) return null;

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 border-b border-gray-200 shadow-sm">
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
            <div className="hidden lg:ml-8 lg:flex lg:space-x-1">
              {navigation.slice(0, 8).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.02]
                      ${item.current 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
          <div className="hidden lg:block lg:flex-1 lg:max-w-md lg:ml-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search regulations, documents..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
                onFocus={(e) => e.target.placeholder = 'Try: "GDPR compliance" or "trading policy"'}
                onBlur={(e) => e.target.placeholder = 'Search regulations, documents...'}
              />
            </div>
          </div>

          {/* Right side items */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <NotificationBell />

            {/* Help */}
            <Link href="/help" className="btn btn-ghost btn-sm">
              <HelpCircle className="h-4 w-4" />
            </Link>

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
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <Link
                    href="/preferences"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100"
                    onClick={() => setIsUserMenuOpen(false)}
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
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 pt-4 pb-3 space-y-1 shadow-lg">
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
    
    {/* Spacer to prevent content from going under fixed navbar */}
    <div className="h-16"></div>
    </>
  );
}