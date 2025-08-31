'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  X, 
  XCircle 
} from 'lucide-react';

interface NotificationToastProps {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function NotificationToast({ 
  message, 
  type, 
  duration = 5000, 
  onClose,
  position = 'top-right'
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);
    
    // Auto close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'error':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-50 border-green-200 text-green-900',
          icon: 'text-green-600',
          progress: 'bg-green-500'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-900',
          icon: 'text-yellow-600',
          progress: 'bg-yellow-500'
        };
      case 'error':
        return {
          container: 'bg-red-50 border-red-200 text-red-900',
          icon: 'text-red-600',
          progress: 'bg-red-500'
        };
      default:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-900',
          icon: 'text-blue-600',
          progress: 'bg-blue-500'
        };
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  const colors = getColorClasses();

  return (
    <div
      className={`
        fixed ${getPositionClasses()} z-[100] max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div className={`
        ${colors.container}
        border rounded-lg shadow-lg overflow-hidden
        backdrop-blur-sm
      `}>
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div 
            className={`h-full ${colors.progress} transition-all linear`}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`
            }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 ${colors.icon}`}>
              {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-5">
                {message}
              </p>
            </div>
            
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}