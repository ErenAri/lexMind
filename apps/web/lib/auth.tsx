'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  username: string;
  email?: string;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => false,
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get user info
      fetchCurrentUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api/v1';
      const response = await fetch(`${base}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token is invalid
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api/v1';
      console.log('🔐 Login attempt:', { username, apiUrl });
      
      const formData = new URLSearchParams();
      formData.set('username', username);
      formData.set('password', password);

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      console.log('🔐 Login response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const newToken = data.access_token;
        console.log('🔐 Login successful, got token');
        
        setToken(newToken);
        localStorage.setItem('auth_token', newToken);
        
        // Fetch user details
        await fetchCurrentUser(newToken);
        return true;
      } else {
        const errorData = await response.text();
        console.error('🔐 Login failed:', response.status, errorData);
        return false;
      }
    } catch (error) {
      console.error('🔐 Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function getRole(): 'viewer' | 'analyst' | 'admin' {
  // Keep for backward compatibility, but prefer useAuth hook
  if (typeof window === 'undefined') return 'viewer';
  const storedRole = localStorage.getItem('role') as any;
  return storedRole === 'analyst' || storedRole === 'admin' ? storedRole : 'viewer';
}


