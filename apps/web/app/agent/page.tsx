"use client";

import React from "react";
import { getBaseApiUrl } from "@/lib/api";
import PerformanceWidget from "@/components/PerformanceWidget";
import AuthWrapper from "@/components/AuthWrapper";

type AgentStep = {
  step: string;
  at?: string;
  [key: string]: any;
};

type AgentResponse = {
  ok: boolean;
  message: string;
  sources_count: number;
  steps: AgentStep[];
  notified?: boolean;
};

export default function AgentRunnerPage() {
  const [query, setQuery] = React.useState("");
  const [notify, setNotify] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AgentResponse | null>(null);
  const [seeding, setSeeding] = React.useState(false);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = React.useState(false);

  const runAgent = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const base = getBaseApiUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`${base}/agent/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query, notify }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as AgentResponse;
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Agent run failed");
    } finally {
      setLoading(false);
    }
  };

  const seedDemo = async () => {
    setSeeding(true);
    setError(null);
    try {
      const base = getBaseApiUrl();
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      // Seed a regulation
      await fetch(`${base}/ingest/reg`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          source: "gdpr",
          title: "GDPR Article 5",
          section: "Art.5",
          text: "Personal data shall be processed lawfully, fairly and in a transparent manner...",
        }),
      });
      // Seed a doc
      await fetch(`${base}/ingest/doc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          path: "policies/risk-policy.txt",
          chunk_idx: 0,
          content:
            "Top compliance risks include data retention issues, access control gaps, and missing transparency notices.",
        }),
      });
    } catch (e: any) {
      setError(e?.message || "Seeding failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Agent Runner</h1>
      <p className="text-sm text-gray-600">
        Orchestrates search → context → AI answer. Optionally posts to Slack when
        SLACK_WEBHOOK_URL is set on the API.
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Query</label>
        <textarea
          className="w-full border rounded p-3 focus:outline-none focus:ring"
          rows={4}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Summarize our GDPR coverage gaps"
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Send Slack notification (if configured)
        </label>
        <button
          onClick={runAgent}
          disabled={loading || query.trim().length < 3}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? "Running..." : "Run Agent"}
        </button>
        <button
          onClick={seedDemo}
          disabled={seeding}
          className="px-3 py-2 rounded border ml-2 text-sm"
          title="Insert small demo records into TiDB via /ingest endpoints"
        >
          {seeding ? "Seeding..." : "Seed demo data"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <PerformanceWidget />
          <div className="p-3 rounded border bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">
              Sources: {result.sources_count} {result.notified ? "• Notified" : ""}
            </div>
            <pre className="whitespace-pre-wrap text-sm">{result.message}</pre>
          </div>
          <div>
            <h2 className="font-medium mb-2">Steps</h2>
            <ol className="space-y-2 list-decimal pl-5">
              {result.steps.map((s, idx) => (
                <li key={idx} className="text-sm">
                  <span className="font-medium">{s.step}</span>
                  {s.at ? <span className="text-gray-500"> — {s.at}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Run history</h2>
          <button
            className="text-sm px-2 py-1 border rounded"
            onClick={async () => {
              try {
                setLoadingRuns(true);
                const base = getBaseApiUrl();
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                const res = await fetch(`${base}/agent/runs?limit=20`, {
                  headers: token ? { 'Authorization': `Bearer ${token}` } as any : undefined
                });
                const data = await res.json();
                setRuns(data.runs || []);
              } catch (e) {
                // ignore UI error
              } finally {
                setLoadingRuns(false);
              }
            }}
            disabled={loadingRuns}
          >
            {loadingRuns ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="border rounded divide-y">
          {runs.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No runs yet.</div>
          ) : (
            runs.map((r) => (
              <div key={r.id} className="p-3 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.query}</div>
                  <div className="text-gray-500">{r.created_at}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">{r.sources_count} src</span>
                  {r.notified ? <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">notified</span> : null}
                  <button
                    className="px-2 py-1 border rounded"
                    title="Re-run"
                    onClick={async () => {
                      setQuery(r.query || "");
                      await runAgent();
                    }}
                  >
                    Re-run
                  </button>
                  <button
                    className="px-2 py-1 border rounded"
                    title="View details"
                    onClick={() => {
                      window.location.href = `/agent/${r.id}`;
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        </div>
      </div>
    </AuthWrapper>
  );
}


