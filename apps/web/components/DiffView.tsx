"use client";
import { useMemo } from "react";

interface DiffViewProps {
  left: string;
  right: string;
}

function diffTokens(a: string, b: string): Array<{ t: string; k: 'same'|'ins'|'del' }>{
  const at = a.split(/(\s+)/);
  const bt = b.split(/(\s+)/);
  const res: Array<{t:string;k:'same'|'ins'|'del'}> = [];
  let i=0,j=0;
  while (i<at.length && j<bt.length) {
    if (at[i] === bt[j]) { res.push({t:at[i], k:'same'}); i++; j++; }
    else if (bt[j] && !at.slice(i+1,i+10).includes(bt[j])) { res.push({t:at[i], k:'del'}); i++; }
    else { res.push({t:bt[j], k:'ins'}); j++; }
  }
  while (i<at.length) { res.push({t:at[i++], k:'del'}); }
  while (j<bt.length) { res.push({t:bt[j++], k:'ins'}); }
  return res;
}

export default function DiffView({ left, right }: DiffViewProps) {
  const leftView = useMemo(() => left, [left]);
  const rightView = useMemo(() => right, [right]);
  const d = useMemo(()=> diffTokens(leftView, rightView), [leftView, rightView]);
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="text-xs text-neutral-500">Diff</div>
      <div className="p-3 bg-white border rounded text-sm leading-relaxed">
        {d.map((x, idx) => (
          <span key={idx} className={x.k==='ins' ? 'bg-green-100' : x.k==='del' ? 'bg-red-100 line-through' : ''}>{x.t}</span>
        ))}
      </div>
    </div>
  );
}


