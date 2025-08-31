"use client";

import React from "react";
import { getBaseApiUrl } from "@/lib/api";

type PerfMetrics = {
  total_queries?: number;
  avg_execution_time?: number;
  cache_hit_rate?: number;
  by_type?: Record<string, { count: number; total_time: number }>;
  by_region?: Record<string, { count: number; total_time: number }>;
};

export default function PerformanceWidget() {
  const [metrics, setMetrics] = React.useState<PerfMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = getBaseApiUrl();
      const res = await fetch(`${base.replace("/api/v1", "")}/serverless/performance/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-3 border rounded bg-white/70">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">TiDB Serverless Performance</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-sm px-2 py-1 border rounded"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="text-sm space-y-1">
          <div>Queries: {metrics?.total_queries ?? 0}</div>
          <div>Avg time: {(metrics?.avg_execution_time ?? 0).toFixed(3)} s</div>
          <div>Cache hit: {((metrics?.cache_hit_rate ?? 0) * 100).toFixed(1)}%</div>
        </div>
      )}
    </div>
  );
}


