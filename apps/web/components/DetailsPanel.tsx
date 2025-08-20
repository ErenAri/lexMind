"use client";
import useSWR from "swr";
import { useState } from "react";
import { motion } from "framer-motion";
import { Lightbulb, CheckCircle2, Wrench, Shield, FileText } from "lucide-react";
import DiffView from "./DiffView";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface DetailsPanelProps {
  query?: string;
  selectedFinding?: any;
}

export default function DetailsPanel({ query, selectedFinding }: DetailsPanelProps) {
  const [explainText, setExplainText] = useState<string>("");
  const [fixitText, setFixitText] = useState<string>("");
  const [loading, setLoading] = useState<"explain" | "fixit" | null>(null);
  
  // Only use selectedFinding, no fallback to mock data
  const reg = selectedFinding?.type === "reg" ? selectedFinding : null;
  const doc = selectedFinding?.type === "doc" ? selectedFinding : null;

  const createTask = async () => {
    await fetch(apiUrl + "/action/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ finding_id: 1, system: "jira", status: "open" }) });
    alert("Task created");
  };

  const runExplain = async () => {
    if (!selectedFinding) return;
    
    setLoading("explain");
    setFixitText("");
    try {
      const res = await fetch(apiUrl + "/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          regulation_text: selectedFinding.type === "reg" ? selectedFinding.text : "N/A", 
          document_text: selectedFinding.type === "doc" ? selectedFinding.content : "N/A", 
          query: query && query.trim() ? query : "compliance analysis" 
        })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setExplainText(JSON.stringify(json.result || json || ""));
    } catch (err: any) {
      setExplainText(`Failed to reach AI service. ${err?.message ?? ""}`);
    } finally {
      setLoading(null);
    }
  };

  const runFixIt = async () => {
    if (!selectedFinding) return;
    
    setLoading("fixit");
    setExplainText("");
    try {
      const res = await fetch(apiUrl + "/ai/fix-it", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          regulation_text: selectedFinding.type === "reg" ? selectedFinding.text : "N/A", 
          document_text: selectedFinding.type === "doc" ? selectedFinding.content : "N/A" 
        })
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setFixitText(JSON.stringify(json.result || json || ""));
    } catch (err: any) {
      setFixitText(`Failed to reach AI service. ${err?.message ?? ""}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-neutral-200 p-4 h-fit shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-700 mb-3">Details</h2>
      
      {selectedFinding ? (
        <div className="space-y-4">
          {/* Selected Finding Header */}
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {selectedFinding.type === "reg" ? <Shield className="text-blue-500" size={16} /> : <FileText className="text-green-500" size={16} />}
              <span className="text-xs font-medium text-brand-700 uppercase tracking-wide">
                {selectedFinding.type === "reg" ? "Regulation" : "Document"}
              </span>
              <span className="ml-auto text-xs text-neutral-500">
                Score: {Math.round((selectedFinding.final_score || 0) * 100)}%
              </span>
            </div>
            <div className="text-sm font-medium text-neutral-900">
              {selectedFinding.type === "reg" ? selectedFinding.section : `ID: ${selectedFinding.id}`}
            </div>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 mb-2">Content</h3>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
              <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                {(() => {
                  const text = selectedFinding.type === "reg" ? selectedFinding.text : selectedFinding.content;
                  const raw = selectedFinding.highlights || [];
                  if (!raw?.length) return text;
                  const spans = raw.map((x: any)=> Array.isArray(x) ? { start: x[0], end: x[1] } : x).slice(0,40);
                  const parts: JSX.Element[] = [];
                  let cursor = 0;
                  for (const { start: s, end: e } of spans) {
                    if (s > cursor) parts.push(<span key={cursor+"n"}>{text.slice(cursor, s)}</span>);
                    parts.push(<mark key={s+"h"} className="bg-amber-100 rounded px-0.5">{text.slice(s, e)}</mark>);
                    cursor = e;
                  }
                  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
                  return parts;
                })()}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {selectedFinding.type === "reg" && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 mb-2">Regulation Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-neutral-50 rounded">
                  <span className="text-neutral-500">Section:</span>
                  <div className="font-medium">{selectedFinding.section}</div>
                </div>
                <div className="p-2 bg-neutral-50 rounded">
                  <span className="text-neutral-500">Source:</span>
                  <div className="font-medium">{selectedFinding.source || "N/A"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded-lg hover:bg-neutral-800 transition disabled:opacity-60" onClick={runExplain} disabled={loading !== null}> 
              <Lightbulb size={16} /> {loading === "explain" ? "Explaining..." : "Explain"}
            </button>
            <button className="inline-flex items-center gap-1 bg-brand-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-brand-700 transition disabled:opacity-60" onClick={runFixIt} disabled={loading !== null}> 
              <Wrench size={16} /> {loading === "fixit" ? "Generating..." : "Fix-it"}
            </button>
            <button className="inline-flex items-center gap-1 border border-neutral-200 text-sm px-3 py-2 rounded-lg hover:bg-neutral-50 transition" onClick={createTask}> 
              <CheckCircle2 size={16} /> Mark as resolved
            </button>
          </div>

          {/* AI Response */}
          {(explainText || fixitText) && (
            <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-800">
              {(() => {
                try {
                  const obj = JSON.parse(explainText || fixitText);
                  if (obj?.summary || obj?.risks) {
                    return (
                      <div>
                        {obj.summary && <div className="mb-2">{obj.summary}</div>}
                        {obj.risks && Array.isArray(obj.risks) && (
                          <ul className="list-disc ml-5 space-y-1">
                            {obj.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                          </ul>
                        )}
                      </div>
                    );
                  }
                  if (obj?.actions) {
                    return (
                      <ul className="space-y-2">
                        {obj.actions.map((a: any, i: number) => (
                          <li key={i} className="p-2 bg-white border rounded">
                            <div className="font-medium">{a.title}</div>
                            <div className="text-xs text-neutral-600">{a.owner || 'Unassigned'} • {a.timeline || 'TBD'}</div>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                } catch {}
                return <pre className="whitespace-pre-wrap">{explainText || fixitText}</pre>;
              })()}
            </div>
          )}

          {/* Simple Diff View when both sides present */}
          {reg && doc && (
            <DiffView left={reg.text} right={doc.content} />
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-neutral-500">
          <FileText size={48} className="mx-auto mb-3 text-neutral-300" />
          <p className="text-sm">Select a finding to view details</p>
          <p className="text-xs mt-1">Click "View details" on any finding above</p>
        </div>
      )}
    </motion.aside>
  );
}
