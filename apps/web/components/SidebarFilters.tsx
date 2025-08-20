"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function SidebarFilters() {
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  return (
    <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-neutral-200 p-4 h-fit shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-700 mb-3">Filters</h2>
      <div className="space-y-3">
        <label className="text-xs text-neutral-500">Risk</label>
        <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-300" value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="med">Medium</option>
          <option value="low">Low</option>
        </select>
        <label className="text-xs text-neutral-500">Status</label>
        <select className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-300" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
    </motion.aside>
  );
}
