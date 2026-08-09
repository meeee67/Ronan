"use client";

import { useState } from "react";
import { QuestTracker } from "./QuestTracker";
import { ScheduleToggle } from "./ScheduleToggle";
import { CallTracker } from "./CallTracker";
import { RevenueDashboard } from "./RevenueDashboard";
import { Timers } from "./Timers";

const TABS = [
  { id: "quests", label: "Quests", icon: "🗺️" },
  { id: "schedule", label: "Schedule", icon: "🕒" },
  { id: "calls", label: "Calls", icon: "📞" },
  { id: "revenue", label: "Revenue", icon: "💰" },
  { id: "timers", label: "Timers", icon: "⏱️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppShell() {
  const [tab, setTab] = useState<TabId>("quests");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          PeakFlow <span className="text-accent">Quest Tracker</span>
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-2xl mx-auto w-full">
        {tab === "quests" && <QuestTracker />}
        {tab === "schedule" && <ScheduleToggle />}
        {tab === "calls" && <CallTracker />}
        {tab === "revenue" && <RevenueDashboard />}
        {tab === "timers" && <Timers />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-border-subtle bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                tab === t.id ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
