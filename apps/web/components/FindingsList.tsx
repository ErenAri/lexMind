"use client";
import useSWR from "swr";
import { motion } from "framer-motion";
import { ArrowRight, AlertTriangle, FileText, Shield, Link as LinkIcon } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
import { fetchJson } from "@/lib/api";
const postFetcher = async (url: string, body: string) => {
  const res = await fetchJson(url, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || (data && data.error)) {
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Request failed');
  }
  return data;
};

function Skeleton() {
  return <div className="animate-pulse space-y-3">
    <div className="h-6 bg-neutral-200 rounded w-1/3" />
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-16 bg-neutral-100 rounded" />
    ))}
  </div>;
}

interface FindingsListProps {
  query?: string;
  onSelectFinding?: (finding: any) => void;
  selectedFinding?: any;
}

export default function FindingsList({ query, onSelectFinding, selectedFinding }: FindingsListProps) {
  // Only fetch when there is a non-empty query
  const hasQuery = !!(query && query.trim());
  const body = JSON.stringify({ query: query, top_k: 10 });
  const { data, error, isLoading } = useSWR(
    hasQuery ? [apiUrl + "/query/hybrid", body] : null,
    ([_url, b]) => postFetcher(_url as string, b as string)
  );
  const items = data?.results || [];
  
  // Only use actual data from API, no mock data
  const displayItems = items;
  
  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm min-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-700">Findings</h2>
        <span className="text-xs text-neutral-500">{displayItems.length} items</span>
      </div>
      {!hasQuery ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText size={48} className="text-neutral-300 mb-4" />
          <p className="text-sm text-neutral-600 mb-2">Search or analyze a document to see findings</p>
          <p className="text-xs text-neutral-500">Use the search bar or click analyze in Recently Uploaded</p>
        </div>
      ) : isLoading ? <Skeleton /> : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle size={48} className="text-red-300 mb-4" />
          <p className="text-sm text-red-600 mb-2">Failed to load findings</p>
          <p className="text-xs text-red-500">{String(error.message || '')}</p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText size={48} className="text-neutral-300 mb-4" />
          <p className="text-sm text-neutral-600 mb-2">
            {query ? `No findings for "${query}"` : "Upload documents or search to see findings"}
          </p>
          <p className="text-xs text-neutral-500">
            {query ? "Try a different search term" : "Start by uploading a document or entering a search query"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayItems.map((f: any, idx: number) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.03 }}
              className={`group rounded-lg border p-4 hover:shadow-md transition bg-gradient-to-br ${
                selectedFinding?.id === f.id 
                  ? 'border-brand-400 bg-brand-50 shadow-md' 
                  : 'border-neutral-200 from-white to-neutral-50'
              }`}>
              <div className="flex items-center gap-2">
                {f.type === "reg" ? <Shield className="text-blue-500" size={18} /> : <FileText className="text-green-500" size={18} />}
                <div className="font-medium">{f.type === "reg" ? `Reg ${f.id}` : `Doc ${f.id}`}</div>
                <div className="ml-auto text-sm text-neutral-500">{Math.round(f.final_score * 100)}%</div>
              </div>
              <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
                {(() => {
                  const text = f.type === "reg" ? (f.text as string) : (f.content as string);
                  const raw = f.highlights || [];
                  if (!raw.length) return text;
                  const spans = raw.map((x: any) => Array.isArray(x) ? { start: x[0], end: x[1] } : x).slice(0,4);
                  const parts: JSX.Element[] = [];
                  let cursor = 0;
                  for (const { start: s, end: e } of spans) {
                    if (s > cursor) parts.push(<span key={cursor + "n"}>{text.slice(cursor, s)}</span>);
                    parts.push(<mark key={s + "h"} className="bg-amber-100 rounded px-0.5">{text.slice(s, e)}</mark>);
                    cursor = e;
                  }
                  if (cursor < text.length) parts.push(<span key={"tail"}>{text.slice(cursor)}</span>);
                  return parts;
                })()}
              </p>
              <div 
                className={`mt-3 flex items-center text-sm hover:underline cursor-pointer w-fit ${
                  selectedFinding?.id === f.id ? 'text-brand-800 font-medium' : 'text-brand-700'
                }`}
                onClick={() => onSelectFinding?.(f)}
              >
                {selectedFinding?.id === f.id ? '✓ Selected' : 'View details'}
                <ArrowRight className="ml-1" size={16} />
              </div>
              <button
                className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50"
                onClick={async () => {
                  // naive link: if this is a doc, link to best reg; if reg, link to top doc
                  const regId = f.type === 'reg' ? f.id : (displayItems.find((x:any)=>x.type==='reg')?.id);
                  const docId = f.type === 'doc' ? f.id : (displayItems.find((x:any)=>x.type==='doc')?.id);
                  if (!regId || !docId) return;
                  await fetchJson(apiUrl + '/mappings', { method:'POST', body: JSON.stringify({ reg_id: regId, doc_id: docId, confidence: 0.9 })});
                  alert('Linked as evidence');
                }}
              >
                <LinkIcon size={14}/> Link as evidence
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
