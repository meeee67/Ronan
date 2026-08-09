import { Phase } from "./types";

function quests(phaseId: string, labels: string[]) {
  return labels.map((label, i) => ({
    id: `${phaseId}-q${i + 1}`,
    label,
  }));
}

export const PHASES: Phase[] = [
  {
    id: "phase1",
    number: 1,
    name: "Build the Weapon",
    milestone: "ARMED",
    reward: "You now have a working demo agent, pricing, and a call list. You are ready to hunt.",
    quests: quests("phase1", [
      "Parent creates Synthflow account",
      "Parent creates Telnyx account + Alberta number",
      "Register Telnyx A2P",
      "Build HVAC demo agent",
      "Test agent 10+ times",
      "Wave invoice templates (3 tiers)",
      "Client service agreement",
      "Call list 30 companies",
      "Practice pitch 3x",
    ]),
  },
  {
    id: "phase2",
    number: 2,
    name: "Start Calling",
    milestone: "DIALER",
    reward: "You've broken the fear barrier. Cold calling is now just a numbers game you know how to play.",
    quests: quests("phase2", [
      "First cold call",
      "5 calls in one day",
      'First "let me think about it"',
      "First live demo",
      "25 total calls",
      "First follow-up text",
      "50 total calls",
      "First diagnosis question",
    ]),
  },
  {
    id: "phase3",
    number: 3,
    name: "First Client",
    milestone: "FIRST BLOOD",
    reward: "You've converted a stranger into a paying client end-to-end. The business is real now.",
    quests: quests("phase3", [
      "First verbal yes",
      "Send Wave invoice + agreement",
      "First Interac payment",
      "Onboarding call",
      "Build custom agent",
      "Missed-call text-back setup",
      "Review gen setup",
      "1-week check-in",
      "Document complaints/requests",
    ]),
  },
  {
    id: "phase4",
    number: 4,
    name: "Scale to 5",
    milestone: "OPERATOR",
    reward: "5 clients, referrals flowing, and recurring revenue. You're running an operation, not chasing leads.",
    quests: quests("phase4", [
      "Client #2",
      "Client #3",
      "Ask for referral",
      "First referral close",
      "Delivery under 2 hours",
      "Client testimonial",
      "Client #4",
      "Client #5",
      "$5k/month recurring",
      "First dental/medspa client",
    ]),
  },
  {
    id: "phase5",
    number: 5,
    name: "Build SaaS",
    milestone: "BUILDER",
    reward: "You've turned a service business into a software product. Beta users are live on your platform.",
    quests: quests("phase5", [
      "Stripe account (at 18)",
      "Supabase project",
      "Next.js landing + Stripe",
      "Onboarding wizard",
      "Retell AI integration",
      "Telnyx integration",
      "Dashboard",
      "Usage tracking",
      "E2E test",
      "Beta to agency clients",
      "First self-serve signup",
    ]),
  },
  {
    id: "phase6",
    number: 6,
    name: "$25k/month",
    milestone: "FREE",
    reward: "$25k/month, accounts in your own name, and the AI agent platform unlocked. You built your way out.",
    quests: quests("phase6", [
      "10 SaaS users",
      "25 SaaS users",
      "50 SaaS users",
      "5 agency at $2,997",
      "Dental+medspa expansion",
      "$10k/month",
      "$15k/month",
      "$25k/month",
      "Transfer accounts to own name",
      "Unlock AI agent platform",
    ]),
  },
];

export const TIER_PRICING: Record<string, { label: string; price: number }> = {
  receptionist: { label: "Receptionist", price: 597 },
  pro: { label: "Pro", price: 1497 },
  growth: { label: "Growth", price: 2997 },
};

export const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  not_interested: "Not interested",
  thinking_about_it: "Thinking about it",
  demo_booked: "Demo booked",
  closed: "Closed",
};

export const SCHEDULES: Record<"summer" | "winter", { label: string; start: string; end: string }[]> = {
  summer: [
    { label: "Wake / Morning routine", start: "05:30", end: "06:30" },
    { label: "Cold call block", start: "06:30", end: "08:30" },
    { label: "Farm work", start: "08:30", end: "17:00" },
    { label: "Dinner / rest", start: "17:00", end: "19:00" },
    { label: "Build block (SaaS/agent work)", start: "19:00", end: "21:30" },
    { label: "Wind down", start: "21:30", end: "22:30" },
  ],
  winter: [
    { label: "Wake / Morning routine", start: "06:30", end: "07:30" },
    { label: "Cold call block", start: "07:30", end: "09:30" },
    { label: "School / farm work", start: "09:30", end: "16:00" },
    { label: "Build block (SaaS/agent work)", start: "16:00", end: "18:30" },
    { label: "Dinner / family", start: "18:30", end: "20:00" },
    { label: "Follow-ups / admin", start: "20:00", end: "21:30" },
  ],
};
