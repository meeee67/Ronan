export type QuestId = string;

export interface Quest {
  id: QuestId;
  label: string;
}

export interface Phase {
  id: string;
  number: number;
  name: string;
  milestone: string;
  reward: string;
  quests: Quest[];
}

export type CallOutcome =
  | "no_answer"
  | "voicemail"
  | "not_interested"
  | "thinking_about_it"
  | "demo_booked"
  | "closed";

export interface CallLogEntry {
  id: string;
  date: string;
  company: string;
  spokeToSomeone: boolean;
  demoGiven: boolean;
  outcome: CallOutcome;
  followUpDate: string;
  notes?: string;
}

export type ClientTier = "receptionist" | "pro" | "growth";

export interface Client {
  id: string;
  name: string;
  tier: ClientTier;
  startDate: string;
  costPerMonth: number;
}

export type TimerBlock = "morning_calls" | "evening_build";

export interface TimerSession {
  id: string;
  block: TimerBlock;
  date: string;
  seconds: number;
}

export type ScheduleType = "summer" | "winter";

export interface ScheduleBlock {
  label: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}
