'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
  showFilters?: boolean;
  className?: string;
}

export default function SearchBar({ 
  placeholder = "Search regulations, documents...",
  onSearch,
  onFilter,
  showFilters = true,
  className = ""
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch?.('');
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className={`
          relative flex items-center transition-all duration-200
          ${isFocused ? 'ring-2 ring-primary-500' : ''}
        `}>
          {/* Search icon */}
          <div className="absolute left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-secondary-400" />
          </div>

          {/* Input field */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className={`
              input pl-10 pr-20 w-full
              ${showFilters ? 'rounded-r-none' : ''}
            `}
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 p-1 text-secondary-400 hover:text-secondary-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search button */}
          <button
            type="submit"
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 p-1.5 
              text-secondary-500 hover:text-primary-600 transition-colors
            `}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Filter button */}
        {showFilters && (
          <button
            type="button"
            onClick={onFilter}
            className="btn btn-secondary rounded-l-none border-l-0 px-3"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        )}
      </form>

      {/* Search suggestions (could be expanded) */}
      {isFocused && query && (
        <div className="absolute top-full left-0 right-0 mt-1 card-elevated py-2 z-50">
          <div className="px-4 py-2 text-sm text-secondary-500">
            Search suggestions would appear here...
          </div>
        </div>
      )}
    </div>
  );
}