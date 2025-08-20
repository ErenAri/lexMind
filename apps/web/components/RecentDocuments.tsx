"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { FileText, Shield, Clock, RefreshCw, Search, Sparkles } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RecentDocument {
  id: number;
  name: string;
  type: "reg" | "doc";
  uploadedAt: string;
  source?: string;
  path?: string;
}

import { fetchJson } from "@/lib/api";
const fetcher = (url: string) => fetchJson(url).then((r) => r.json());

interface RecentDocumentsProps {
  key?: number;
  onAnalyze?: (searchQuery: string) => void;
}

export default function RecentDocuments({ key, onAnalyze }: RecentDocumentsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyzingDoc, setAnalyzingDoc] = useState<string | null>(null);
  
  // Fetch recent documents from both tables
  const { data: recentDocs, mutate } = useSWR(
    `${apiUrl}/recent-documents`,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      fallbackData: { documents: [] }
    }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleAnalyze = async (doc: RecentDocument) => {
    setAnalyzingDoc(doc.name);
    
    try {
      // Generate a search query based on the document name
      const searchQuery = doc.name
        .replace(/\.[^/.]+$/, "") // Remove file extension
        .replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
        .trim();
      
      // Call the parent's onAnalyze function if provided
      if (onAnalyze) {
        onAnalyze(searchQuery);
      }
    } catch (error) {
      console.error("Error analyzing document:", error);
    } finally {
      setTimeout(() => setAnalyzingDoc(null), 1000);
    }
  };

  const documents = recentDocs?.documents || [];

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-700">Recently Uploaded</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw 
            size={14} 
            className={`text-neutral-500 ${isRefreshing ? 'animate-spin' : ''}`} 
          />
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.slice(0, 5).map((doc, idx) => (
                          <motion.div
              key={doc.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {doc.type === "reg" ? (
                  <Shield size={16} className="text-blue-500" />
                ) : (
                  <FileText size={16} className="text-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {doc.type === "reg" ? "Regulation" : "Company Document"} • {formatTime(doc.uploadedAt)}
                </p>
              </div>
              <button
                onClick={() => handleAnalyze(doc)}
                disabled={analyzingDoc === doc.name}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-brand-50 rounded-lg text-brand-600 hover:text-brand-700"
                title="Analyze document"
              >
                {analyzingDoc === doc.name ? (
                  <Sparkles size={14} className="animate-pulse" />
                ) : (
                  <Search size={14} />
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {documents.length > 5 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-xs text-neutral-500 text-center">
            Showing 5 of {documents.length} documents
          </p>
        </div>
      )}
    </section>
  );
}
