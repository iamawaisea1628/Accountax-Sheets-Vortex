"use client";
import { motion } from "framer-motion";

type Tab = { id: string; label: string; badge?: number };

export default function Tabs({ tabs, value, onChange, id }: { tabs: Tab[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div role="tablist" className="relative inline-flex max-w-full overflow-x-auto rounded-lg bg-[#dfe8e2] p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className="relative whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold">
          {value === t.id && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-md bg-gradient-to-r from-[#1ccb98] to-[#0b7f68] shadow-md shadow-brand/30" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className={`relative ${value === t.id ? "text-white" : "text-ink/55"}`}>
            {t.label}
            {!!t.badge && <span className="ml-2 rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-bold text-white">{t.badge}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
