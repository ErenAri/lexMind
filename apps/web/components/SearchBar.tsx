"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = "Search regulations, documents..." }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setQuery("");
    if (onSearch) onSearch("");
  };

  return (
    <div className="relative w-80 hidden md:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyPress={handleKeyPress}
        className="w-full rounded-lg border border-neutral-200 pl-9 pr-10 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all placeholder:text-neutral-400"
        placeholder={placeholder}
      />
      <AnimatePresence>
        {query && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={16} />
          </motion.button>
        )}
      </AnimatePresence>
      {isFocused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 z-10"
        >
          <div className="text-xs text-neutral-500 mb-2">Quick search tips:</div>
          <div className="text-xs text-neutral-600 space-y-1">
            <div>• Use quotes for exact phrases</div>
            <div>• Add "risk:high" to filter by risk level</div>
            <div>• Type "reg:" to search regulations only</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
