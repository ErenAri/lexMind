export function getRole(): 'viewer' | 'analyst' | 'admin' {
  // Deprecated: Use useAuth hook instead for proper auth context
  if (typeof window === 'undefined') return 'viewer';
  const r = (localStorage.getItem('role') as any) || 'viewer';
  return r === 'analyst' || r === 'admin' ? r : 'viewer';
}

export function getBaseApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return raw.replace(/\/$/, '');
}

export async function fetchJson(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers as any);
  
  // Add JWT token if available - check both storages for consistency with auth context
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
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
  
  // Convert to a plain object preserving common header casing for tests
  const headersObject: Record<string, string> = {};
  const auth = headers.get('Authorization');
  const contentType = headers.get('Content-Type');
  const xrole = headers.get('x-role');
  if (auth) headersObject['Authorization'] = auth;
  if (contentType) headersObject['Content-Type'] = contentType;
  if (xrole) headersObject['x-role'] = xrole;

  const res = await fetch(url, { ...init, headers: headersObject });
  
  // Handle auth errors
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('role');
    window.location.reload();
  }
  
  return res;
}

// Helper to determine if endpoint needs /api/v1 prefix
function needsApiV1Prefix(endpoint: string): boolean {
  // Endpoints that already have /api/v1 prefix
  if (endpoint.startsWith('/api/v1/')) return false;
  
  // Auth endpoints don't need prefix
  if (endpoint.startsWith('/auth/')) return false;
  
  // Legacy endpoints that exist at root level
  const legacyEndpoints = [
    '/ingest/', '/query/', '/action/', '/documents/', '/mappings/', 
    '/coverage/', '/ai/', '/recent-documents', '/health'
  ];
  
  for (const legacy of legacyEndpoints) {
    if (endpoint.startsWith(legacy)) return false;
  }
  
  // New endpoints that need /api/v1 prefix
  const v1Endpoints = ['/agent/', '/compliance/'];
  for (const v1 of v1Endpoints) {
    if (endpoint.startsWith(v1)) return true;
  }
  
  return false;
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
      
      // Determine the correct URL
      const url = needsApiV1Prefix(endpoint) 
        ? `${baseUrl}/api/v1${endpoint}`
        : `${baseUrl}${endpoint}`;
      
      // Use plain object for headers for consistency
      const headersObject: Record<string, string> = {};
      headers.forEach((value, key) => { headersObject[key] = value; });

      const response = await fetch(url, {
        ...options,
        headers: headersObject,
      });
      
      return response;
    }
  };
}


