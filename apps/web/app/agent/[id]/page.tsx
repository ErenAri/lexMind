"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { getBaseApiUrl } from "@/lib/api";

type RunDetail = {
  id: number;
  query: string;
  answer: string;
  sources_count: number;
  steps_json?: any;
  steps?: Array<{ step: string; at?: string; [k: string]: any }>; 
  notified: boolean;
  created_at: string;
};

export default function AgentRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params?.id as string;
  const [data, setData] = React.useState<RunDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notify, setNotify] = React.useState(false);
  const [rerunning, setRerunning] = React.useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const base = getBaseApiUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`${base}/agent/runs/${runId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } as any : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load run");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (runId) load();
  }, [runId]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent Run #{runId}</h1>
        <button onClick={() => router.back()} className="px-3 py-1 border rounded text-sm">Back</button>
      </div>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {data && (
        <div className="space-y-4">
          <div className="p-3 rounded border bg-white/70">
            <div className="text-xs text-gray-500 mb-2">Query</div>
            <div className="text-sm">{data.query}</div>
          </div>
          <div className="p-3 rounded border bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">Answer</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border rounded text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(((data as any).answer || (data as any).message) || '');
                    } catch {}
                  }}
                >
                  Copy
                </button>
                <button
                  className="px-2 py-1 border rounded text-xs"
                  onClick={() => {
                    const q = encodeURIComponent(data.query || '');
                    window.location.href = `/chat?prefill=${q}`;
                  }}
                >
                  Open in chat
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm">{(data as any).answer || (data as any).message}</pre>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{data.sources_count} sources</span>
            {data.notified ? <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">notified</span> : null}
            <span className="text-gray-400">·</span>
            <span>{data.created_at}</span>
          </div>
          <div>
            <h2 className="font-medium mb-2">Steps</h2>
            <ol className="space-y-2 list-decimal pl-5">
              {(data.steps || data.steps_json || []).map((s: any, idx: number) => (
                <li key={idx} className="text-sm">
                  <span className="font-medium">{s.step}</span>
                  {s.at ? <span className="text-gray-500"> — {s.at}</span> : null}
                </li>
              ))}
            </ol>
          </div>
          <div className="p-3 rounded border bg-white/70">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Slack notify
              </label>
              <button
                disabled={rerunning}
                onClick={async () => {
                  try {
                    setRerunning(true);
                    const base = getBaseApiUrl();
                    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                    const res = await fetch(`${base}/agent/run`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify({ query: data.query, notify })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    await load();
                  } catch (e) {
                    // ignore inline error
                  } finally {
                    setRerunning(false);
                  }
                }}
                className="px-3 py-1 border rounded text-sm"
              >
                {rerunning ? 'Re-running...' : 'Re-run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


