'use client';

import React, { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import NotificationCenter from './NotificationCenter';

export default function NotificationBell() {
  const { unreadCount, isConnected } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`
          relative p-2 rounded-lg transition-colors
          ${isOpen 
            ? 'bg-blue-100 text-blue-600' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }
        `}
        title="Notifications"
      >
        <div className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          
          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
          
          {/* Connection Status Indicator */}
          <div className={`
            absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
            ${isConnected ? 'bg-green-500' : 'bg-gray-400'}
          `} />
        </div>
      </button>

      <NotificationCenter isOpen={isOpen} onToggle={handleToggle} />
    </>
  );
}