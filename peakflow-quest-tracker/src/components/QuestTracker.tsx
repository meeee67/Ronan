"use client";

import { useEffect, useRef, useState } from "react";
import { PHASES } from "@/lib/phases";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ProgressBar } from "./ProgressBar";
import { Confetti } from "./Confetti";

type QuestState = Record<string, boolean>;

function phaseCompletion(phaseId: string, questIds: string[], state: QuestState) {
  const done = questIds.filter((id) => state[id]).length;
  return { done, total: questIds.length, percent: questIds.length ? (done / questIds.length) * 100 : 0 };
}

function PhaseSection({
  phase,
  state,
  onToggle,
}: {
  phase: (typeof PHASES)[number];
  state: QuestState;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(phase.number === 1);
  const questIds = phase.quests.map((q) => q.id);
  const { done, total, percent } = phaseCompletion(phase.id, questIds, state);
  const isComplete = total > 0 && done === total;

  const wasCompleteRef = useRef(isComplete);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 1400);
      wasCompleteRef.current = isComplete;
      return () => clearTimeout(t);
    }
    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-colors ${
        isComplete
          ? "border-accent/60 bg-accent-soft"
          : "border-border-subtle bg-surface"
      }`}
    >
      {showBurst && <Confetti />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:opacity-80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted">PHASE {phase.number}</span>
            <span className="font-semibold text-foreground truncate">{phase.name}</span>
            {isComplete && (
              <span className="animate-celebrate inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-black">
                COMPLETE
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar percent={percent} />
            <span className="shrink-0 text-xs font-mono text-muted">
              {done}/{total}
            </span>
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border-subtle px-4 py-3">
          <ul className="space-y-2">
            {phase.quests.map((quest) => (
              <li key={quest.id}>
                <label className="flex items-start gap-3 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={!!state[quest.id]}
                    onChange={() => onToggle(quest.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-subtle bg-surface-raised text-accent accent-accent focus:ring-accent focus:ring-offset-0"
                  />
                  <span
                    className={`text-sm leading-5 ${
                      state[quest.id] ? "text-muted line-through" : "text-foreground"
                    }`}
                  >
                    {quest.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {isComplete && (
            <div className="animate-celebrate mt-4 rounded-lg border border-accent/50 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <span className="font-mono text-sm font-bold text-accent">
                  MILESTONE UNLOCKED: {phase.milestone}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{phase.reward}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestTracker() {
  const [state, setState, hydrated] = useLocalStorage<QuestState>("peakflow-quests-v1", {});

  const toggle = (id: string) => {
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allQuestIds = PHASES.flatMap((p) => p.quests.map((q) => q.id));
  const totalDone = allQuestIds.filter((id) => state[id]).length;
  const overallPercent = allQuestIds.length ? (totalDone / allQuestIds.length) * 100 : 0;
  const completedPhases = PHASES.filter(
    (p) => p.quests.length > 0 && p.quests.every((q) => state[q.id])
  ).length;

  if (!hydrated) {
    return <div className="text-sm text-muted">Loading quest log…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Overall Progress</h2>
          <span className="font-mono text-sm text-accent">{Math.round(overallPercent)}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar percent={overallPercent} height="h-3" />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>
            {totalDone}/{allQuestIds.length} quests
          </span>
          <span>
            {completedPhases}/{PHASES.length} phases complete
          </span>
        </div>
      </div>

      {PHASES.map((phase) => (
        <PhaseSection key={phase.id} phase={phase} state={state} onToggle={toggle} />
      ))}
    </div>
  );
}
