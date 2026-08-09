"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { CallLogEntry, CallOutcome } from "@/lib/types";
import { OUTCOME_LABELS } from "@/lib/phases";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const OUTCOME_ORDER: CallOutcome[] = [
  "no_answer",
  "voicemail",
  "not_interested",
  "thinking_about_it",
  "demo_booked",
  "closed",
];

const emptyForm = {
  date: todayISO(),
  company: "",
  spokeToSomeone: false,
  demoGiven: false,
  outcome: "no_answer" as CallOutcome,
  followUpDate: "",
};

export function CallTracker() {
  const [calls, setCalls, hydrated] = useLocalStorage<CallLogEntry[]>(
    "peakflow-calls-v1",
    []
  );
  const [form, setForm] = useState(emptyForm);

  const totals = useMemo(() => {
    const total = calls.length;
    const spoke = calls.filter((c) => c.spokeToSomeone).length;
    const demos = calls.filter((c) => c.demoGiven).length;
    const closed = calls.filter((c) => c.outcome === "closed").length;
    const booked = calls.filter((c) => c.outcome === "demo_booked").length;
    return { total, spoke, demos, closed, booked };
  }, [calls]);

  const sorted = useMemo(
    () => [...calls].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [calls]
  );

  if (!hydrated) {
    return <div className="text-sm text-muted">Loading call log…</div>;
  }

  const addCall = () => {
    if (!form.company.trim()) return;
    const entry: CallLogEntry = {
      id: uid(),
      date: form.date || todayISO(),
      company: form.company.trim(),
      spokeToSomeone: form.spokeToSomeone,
      demoGiven: form.demoGiven,
      outcome: form.outcome,
      followUpDate: form.followUpDate,
    };
    setCalls((prev) => [entry, ...prev]);
    setForm({ ...emptyForm, date: todayISO() });
  };

  const removeCall = (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total calls" value={totals.total} />
        <StatCard label="Spoke to someone" value={totals.spoke} />
        <StatCard label="Demos given" value={totals.demos} />
        <StatCard label="Demo booked" value={totals.booked} />
        <StatCard label="Closed" value={totals.closed} accent />
        <StatCard
          label="Close rate"
          value={totals.total ? `${Math.round((totals.closed / totals.total) * 100)}%` : "0%"}
        />
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-3">
        <h3 className="font-semibold text-sm">Log a call</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Follow-up date
            <input
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
              className="rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted">
          Company name
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="e.g. Prairie HVAC Ltd"
            className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/60"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <ToggleField
            label="Spoke to someone"
            value={form.spokeToSomeone}
            onChange={(v) => setForm((f) => ({ ...f, spokeToSomeone: v }))}
          />
          <ToggleField
            label="Demo given"
            value={form.demoGiven}
            onChange={(v) => setForm((f) => ({ ...f, demoGiven: v }))}
          />
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted">
          Outcome
          <select
            value={form.outcome}
            onChange={(e) =>
              setForm((f) => ({ ...f, outcome: e.target.value as CallOutcome }))
            }
            className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground"
          >
            {OUTCOME_ORDER.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={addCall}
          disabled={!form.company.trim()}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
        >
          Log call
        </button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-center text-sm text-muted py-6">No calls logged yet.</p>
        )}
        {sorted.map((call) => (
          <div
            key={call.id}
            className="rounded-xl border border-border-subtle bg-surface p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{call.company}</p>
                <p className="text-xs text-muted">{call.date}</p>
              </div>
              <button
                type="button"
                onClick={() => removeCall(call.id)}
                className="shrink-0 text-xs text-muted hover:text-red-400"
                aria-label="Delete call"
              >
                Delete
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge active={call.spokeToSomeone}>
                {call.spokeToSomeone ? "Spoke Y" : "Spoke N"}
              </Badge>
              <Badge active={call.demoGiven}>
                {call.demoGiven ? "Demo Y" : "Demo N"}
              </Badge>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
                {OUTCOME_LABELS[call.outcome]}
              </span>
              {call.followUpDate && (
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-muted">
                  Follow-up {call.followUpDate}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <div className="flex rounded-lg bg-surface-raised p-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            value ? "bg-accent text-black" : "text-muted"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            !value ? "bg-accent text-black" : "text-muted"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function Badge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium ${
        active ? "bg-accent-soft text-accent" : "bg-surface-raised text-muted"
      }`}
    >
      {children}
    </span>
  );
}
