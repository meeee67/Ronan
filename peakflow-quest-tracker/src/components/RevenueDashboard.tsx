"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Client, ClientTier } from "@/lib/types";
import { TIER_PRICING } from "@/lib/phases";
import { ProgressBar } from "./ProgressBar";

function uid() {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_COST: Record<ClientTier, number> = {
  receptionist: 47,
  pro: 97,
  growth: 197,
};

const MILESTONES = [5000, 25000];

const emptyForm = {
  name: "",
  tier: "receptionist" as ClientTier,
  startDate: todayISO(),
};

export function RevenueDashboard() {
  const [clients, setClients, hydrated] = useLocalStorage<Client[]>(
    "peakflow-clients-v1",
    []
  );
  const [form, setForm] = useState(emptyForm);

  const stats = useMemo(() => {
    const mrr = clients.reduce((sum, c) => sum + TIER_PRICING[c.tier].price, 0);
    const totalCost = clients.reduce((sum, c) => sum + c.costPerMonth, 0);
    const profit = mrr - totalCost;
    const marginPct = mrr > 0 ? (profit / mrr) * 100 : 0;
    return { mrr, totalCost, profit, marginPct };
  }, [clients]);

  if (!hydrated) {
    return <div className="text-sm text-muted">Loading revenue dashboard…</div>;
  }

  const addClient = () => {
    if (!form.name.trim()) return;
    const entry: Client = {
      id: uid(),
      name: form.name.trim(),
      tier: form.tier,
      startDate: form.startDate || todayISO(),
      costPerMonth: DEFAULT_COST[form.tier],
    };
    setClients((prev) => [...prev, entry]);
    setForm({ ...emptyForm, startDate: todayISO() });
  };

  const removeClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCost = (id: string, cost: number) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, costPerMonth: cost } : c))
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-xl border border-accent/50 bg-accent-soft p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total MRR</p>
          <p className="mt-1 text-3xl font-bold text-accent">
            ${stats.mrr.toLocaleString()}
          </p>
        </div>
        <StatBox label="Total clients" value={clients.length} />
        <StatBox
          label="Margin"
          value={clients.length ? `${Math.round(stats.marginPct)}%` : "—"}
        />
        <StatBox label="Monthly cost" value={`$${stats.totalCost.toLocaleString()}`} />
        <StatBox label="Monthly profit" value={`$${stats.profit.toLocaleString()}`} accent />
      </div>

      <div className="space-y-3">
        {MILESTONES.map((milestone) => {
          const percent = Math.min(100, (stats.mrr / milestone) * 100);
          const reached = stats.mrr >= milestone;
          return (
            <div
              key={milestone}
              className={`rounded-xl border p-3 ${
                reached ? "border-accent bg-accent-soft" : "border-border-subtle bg-surface"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className={reached ? "font-semibold text-accent" : "font-medium"}>
                  {reached ? "✓ " : ""}${milestone.toLocaleString()}/month milestone
                </span>
                <span className="font-mono text-xs text-muted">
                  ${stats.mrr.toLocaleString()} / ${milestone.toLocaleString()}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar percent={percent} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add client</h3>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Client / business name
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Northside Dental"
            className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/60"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tier
            <select
              value={form.tier}
              onChange={(e) =>
                setForm((f) => ({ ...f, tier: e.target.value as ClientTier }))
              }
              className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground"
            >
              {(Object.keys(TIER_PRICING) as ClientTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_PRICING[tier].label} (${TIER_PRICING[tier].price})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Start date
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="rounded-lg border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={addClient}
          disabled={!form.name.trim()}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
        >
          Add client
        </button>
      </div>

      <div className="space-y-2">
        {clients.length === 0 && (
          <p className="text-center text-sm text-muted py-6">No clients yet.</p>
        )}
        {clients.map((client) => (
          <div key={client.id} className="rounded-xl border border-border-subtle bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{client.name}</p>
                <p className="text-xs text-muted">
                  {TIER_PRICING[client.tier].label} · ${TIER_PRICING[client.tier].price}/mo since{" "}
                  {client.startDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeClient(client.id)}
                className="shrink-0 text-xs text-muted hover:text-red-400"
                aria-label="Remove client"
              >
                Remove
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              Est. cost/mo
              <input
                type="number"
                min={0}
                value={client.costPerMonth}
                onChange={(e) => updateCost(client.id, Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-border-subtle bg-surface-raised px-2 py-1 text-sm text-foreground"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
