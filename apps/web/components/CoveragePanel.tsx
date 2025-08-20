"use client";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
import { fetchJson } from "@/lib/api";
const fetcher = async (url: string) => {
  const res = await fetchJson(url);
  const data = await res.json();
  if (!res.ok || (data && data.error)) {
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'Request failed');
  }
  return data;
};

export default function CoveragePanel({ onSelectReg }: { onSelectReg?: (reg: any) => void }) {
  const { data, error, isLoading } = useSWR(apiUrl + "/coverage", fetcher, { refreshInterval: 20000 });
  const items = (data?.items || []) as Array<{ reg_id: number; section: string; evidence_count: number }>;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-blue-500" />
        <h3 className="text-sm font-semibold text-neutral-700">Coverage</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-neutral-100 rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-red-600">Failed to load coverage. {String(error.message || '')}</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-neutral-500">No mappings yet. Link evidence from findings.</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((it, idx) => (
            <CoverageRow key={it.reg_id} idx={idx} regId={it.reg_id} section={it.section} count={it.evidence_count} onSelectReg={onSelectReg} />
          ))}
        </div>
      )}
    </section>
  );
}

function CoverageRow({ idx, regId, section, count, onSelectReg }: { idx: number; regId: number; section: string; count: number; onSelectReg?: (reg:any)=>void }) {
  const { data, error } = useSWR(apiUrl + "/coverage/" + regId, fetcher);
  const detail = data?.items || [];
  const reg = data?.reg;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="text-sm">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => reg && onSelectReg?.({ id: reg.id, type: 'reg', section: reg.section, text: reg.text, final_score: 1 })}>
        <div className="truncate">{section || `Reg ${regId}`}</div>
        <span className={`px-2 py-0.5 rounded-full text-xs ${count > 0 ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
          {count} evidence
        </span>
      </div>
      {!error && detail.length > 0 && (
        <div className="mt-1 grid grid-cols-4 gap-1">
          {detail.slice(0, 8).map((_: any, i: number) => (
            <div key={i} className={"h-2 rounded " + (i % 2 ? 'bg-green-300' : 'bg-green-200')} />
          ))}
        </div>
      )}
      {error && <div className="mt-1 text-xs text-red-600">Failed to load details</div>}
    </motion.div>
  );
}


