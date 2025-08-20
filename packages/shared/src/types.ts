export type RegText = { id: number; source: string; title: string; section: string; text: string; score?: number };
export type CorpDoc = { id: number; path: string; chunk_idx: number; content: string; score?: number };
export type Finding = { id: number; reg_id: number; doc_id: number; risk_score: number; rationale: string };
export type Task = { id: number; finding_id: number; system: string; external_id?: string | null; status: string; assignee?: string | null; due_date?: string | null };

export type HybridResult = {
  type: 'reg' | 'doc';
  id: number;
  section?: string;
  text?: string;
  content?: string;
  final_score: number;
  highlights?: [number, number][];
};

export type DocumentListItem = {
  path: string;
  display_name: string;
  description?: string | null;
  resolved: boolean;
  first_seen?: string | null;
  last_seen?: string | null;
  chunks: number;
  type: 'reg' | 'doc';
};