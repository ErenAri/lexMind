export function getRole(): 'viewer' | 'analyst' | 'admin' {
  // Deprecated: Use useAuth hook instead for proper auth context
  if (typeof window === 'undefined') return 'viewer';
  const r = (localStorage.getItem('role') as any) || 'viewer';
  return r === 'analyst' || r === 'admin' ? r : 'viewer';
}

export function getBaseApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  // Standardize on versioned API
  return raw.replace(/\/$/, '') + '/api/v1';
}

export async function fetchJson(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers as any);
  
  // Add JWT token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    // Fallback to legacy x-role header only in development and when explicitly enabled
    if (process.env.NODE_ENV !== 'production' && (process.env.NEXT_PUBLIC_ENABLE_ROLE_FALLBACK === '1')) {
      headers.set('x-role', getRole());
    }
  }
  
  if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  
  const res = await fetch(url, { ...init, headers });
  
  // Handle auth errors
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('role');
    window.location.reload();
  }
  
  return res;
}

// New helper for authenticated API calls with token from auth context
export function createApiClient(token: string | null) {
  const baseUrl = getBaseApiUrl();
  
  return {
    async request(endpoint: string, options: RequestInit = {}) {
      const headers = new Headers(options.headers);
      
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
        headers.set('Content-Type', 'application/json');
      }
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
      
      return response;
    }
  };
}


