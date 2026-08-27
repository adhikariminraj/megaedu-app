"use client";

import { useEffect, useState } from "react";

type SchoolOption = { id: string; name: string; location: string | null };

export default function SchoolPicker({
  value,
  onChange,
}: {
  value: SchoolOption | null;
  onChange: (school: SchoolOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) return; // don't re-search once a school is selected
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/schools/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.schools || []);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50">
        <div>
          <p className="text-sm font-medium text-slate-800">{value.name}</p>
          {value.location && <p className="text-xs text-slate-500">{value.location}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs font-medium text-mega-blue"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search for your school..."
        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className="block w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm"
            >
              <span className="font-medium text-slate-800">{s.name}</span>
              {s.location && <span className="text-slate-400"> · {s.location}</span>}
            </button>
          ))}
        </div>
      )}
      {open && query.length > 1 && results.length === 0 && (
        <p className="text-xs text-slate-400 mt-1">
          No verified schools found. Your school needs to register and be
          verified before you can join it.
        </p>
      )}
    </div>
  );
}
