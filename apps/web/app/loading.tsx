import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm">
            <div className="text-xl font-bold">L</div>
          </div>
          <div className="ml-3 text-2xl font-bold text-gradient">LexMind</div>
        </div>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
        
        <p className="text-secondary-600">Loading...</p>
      </div>
    </div>
  );
}