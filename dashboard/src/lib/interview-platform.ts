export type InterviewType = "technical" | "behavioral" | "screening";
export type Difficulty = "junior" | "mid" | "senior";
export type SessionStatus = "queued" | "connecting" | "active" | "completed" | "failed";

export interface AgentRecord {
  id: number;
  name: string;
  role: string;
  language: string;
  llm_model: string;
  stt_model: string;
  tts_model: string;
  interview_type: InterviewType;
  difficulty: Difficulty;
  job_title: string | null;
  company_name: string | null;
  topics: string[] | null;
  max_questions: number;
  voice_id: string;
  system_instruction: string | null;
  created_at: string;
}

export interface SessionRecord {
  id: number;
  room_name: string;
  status: SessionStatus | string;
  duration_seconds: number | null;
  created_at: string;
  agent_id?: number;
  agent_name?: string;
  candidate_name?: string;
}

export interface StatsSnapshot {
  total_agents: number;
  total_sessions: number;
  completed_sessions: number;
  active_sessions?: number;
  avg_duration_seconds: number | null;
}

export interface TranscriptEntry {
  id?: number;
  session_id?: number;
  speaker: "candidate" | "agent" | "system" | string;
  text: string;
  time?: string;
  created_at?: string;
  source?: string;
  is_partial?: boolean;
}

export interface AgentDraft {
  name: string;
  role: string;
  job_title: string;
  company_name: string;
  interview_type: InterviewType;
  difficulty: Difficulty;
  topics: string[];
  max_questions: number;
  system_instruction: string;
  language: string;
  tts_model: "elevenlabs";
  voice_id: string;
  stt_model: "elevenlabs";
  llm_model: "claude-haiku";
  llm_temperature: number;
  vad_sensitivity: number;
  tone: "warm" | "balanced" | "rigorous";
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

export const agentTypeMeta: Record<InterviewType, { label: string; accent: string; soft: string; blurb: string }> = {
  technical: {
    label: "Technical",
    accent: "#57d18c",
    soft: "rgba(87, 209, 140, 0.14)",
    blurb: "Coding, architecture, and problem solving.",
  },
  behavioral: {
    label: "Behavioral",
    accent: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.14)",
    blurb: "Leadership, collaboration, and communication.",
  },
  screening: {
    label: "Screening",
    accent: "#60a5fa",
    soft: "rgba(96, 165, 250, 0.14)",
    blurb: "Role fit, expectations, and logistics.",
  },
};

export const difficultyMeta: Record<Difficulty, { label: string; detail: string }> = {
  junior: { label: "Junior", detail: "2 years or less" },
  mid: { label: "Mid-level", detail: "2 to 5 years" },
  senior: { label: "Senior", detail: "5+ years" },
};

export const sessionStatusMeta: Record<string, { label: string; accent: string; soft: string }> = {
  queued: { label: "Queued", accent: "#94a3b8", soft: "rgba(148, 163, 184, 0.12)" },
  connecting: { label: "Connecting", accent: "#60a5fa", soft: "rgba(96, 165, 250, 0.12)" },
  active: { label: "Live", accent: "#57d18c", soft: "rgba(87, 209, 140, 0.12)" },
  completed: { label: "Completed", accent: "#57d18c", soft: "rgba(87, 209, 140, 0.12)" },
  failed: { label: "Failed", accent: "#f87171", soft: "rgba(248, 113, 113, 0.12)" },
};

export const voicePresets = [
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", style: "knowledgeable, professional" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", style: "mature, reassuring, confident" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", style: "steady broadcaster" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", style: "relaxed, neutral, informative" },
];

export const topicPresets: Record<InterviewType, string[]> = {
  technical: ["System Design", "APIs", "Databases", "Reliability", "Tradeoffs", "Debugging"],
  behavioral: ["Leadership", "Conflict Resolution", "Feedback", "Ambiguity", "Ownership"],
  screening: ["Career Goals", "Salary", "Availability", "Role Alignment", "Motivation"],
};

export const defaultAgentDraft: AgentDraft = {
  name: "",
  role: "Interviewing Agent",
  job_title: "",
  company_name: "",
  interview_type: "technical",
  difficulty: "mid",
  topics: [],
  max_questions: 10,
  system_instruction: "",
  language: "en",
  tts_model: "elevenlabs",
  voice_id: voicePresets[0].id,
  stt_model: "elevenlabs",
  llm_model: "claude-haiku",
  llm_temperature: 0.3,
  vad_sensitivity: 0.5,
  tone: "balanced",
};

export const mockStats: StatsSnapshot = {
  total_agents: 8,
  total_sessions: 24,
  completed_sessions: 19,
  active_sessions: 2,
  avg_duration_seconds: 1040,
};

export const mockAgents: AgentRecord[] = [
  {
    id: 1,
    name: "Avery",
    role: "Senior Backend Interviewer",
    language: "en",
    llm_model: "claude-haiku",
    stt_model: "elevenlabs",
    tts_model: "elevenlabs",
    interview_type: "technical",
    difficulty: "senior",
    job_title: "Backend Engineer",
    company_name: "Northstar",
    topics: ["System Design", "APIs", "Databases"],
    max_questions: 10,
    voice_id: voicePresets[0].id,
    system_instruction: "Run a concise but rigorous backend interview.",
    created_at: "2026-06-12T08:15:00.000Z",
  },
  {
    id: 2,
    name: "Mina",
    role: "Behavioral Panel Lead",
    language: "en",
    llm_model: "claude-haiku",
    stt_model: "elevenlabs",
    tts_model: "elevenlabs",
    interview_type: "behavioral",
    difficulty: "mid",
    job_title: "Product Designer",
    company_name: "Mode",
    topics: ["Leadership", "Feedback", "Ownership"],
    max_questions: 8,
    voice_id: voicePresets[1].id,
    system_instruction: "Focus on evidence and concrete examples.",
    created_at: "2026-06-11T14:30:00.000Z",
  },
  {
    id: 3,
    name: "Riley",
    role: "Screening Concierge",
    language: "en",
    llm_model: "claude-haiku",
    stt_model: "elevenlabs",
    tts_model: "elevenlabs",
    interview_type: "screening",
    difficulty: "junior",
    job_title: "Support Engineer",
    company_name: "Helio",
    topics: ["Career Goals", "Availability"],
    max_questions: 6,
    voice_id: voicePresets[2].id,
    system_instruction: "Keep the flow short and crisp.",
    created_at: "2026-06-10T09:45:00.000Z",
  },
];

export const mockSessions: SessionRecord[] = [
  {
    id: 101,
    room_name: "interview_101",
    status: "active",
    duration_seconds: 842,
    created_at: "2026-06-12T07:50:00.000Z",
    agent_id: 1,
    agent_name: "Avery",
    candidate_name: "Jamie",
  },
  {
    id: 100,
    room_name: "interview_100",
    status: "completed",
    duration_seconds: 1308,
    created_at: "2026-06-12T06:30:00.000Z",
    agent_id: 2,
    agent_name: "Mina",
    candidate_name: "Taylor",
  },
  {
    id: 99,
    room_name: "interview_99",
    status: "queued",
    duration_seconds: null,
    created_at: "2026-06-12T09:00:00.000Z",
    agent_id: 3,
    agent_name: "Riley",
    candidate_name: "Alex",
  },
];

export const mockTranscript: TranscriptEntry[] = [
  { speaker: "agent", text: "Thanks for joining. I’ll keep this focused and practical. Let’s start with how you approach tradeoffs in system design.", time: "09:12" },
  { speaker: "candidate", text: "I usually start by clarifying the constraints, then I compare the simplest design with the one that scales best.", time: "09:12" },
  { speaker: "agent", text: "Good. Walk me through how you’d evolve a read-heavy API if traffic doubled in two months.", time: "09:13" },
];

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fmtSeconds(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
}

export function fmtDate(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function buildInterviewPrompt(draft: AgentDraft) {
  const topicLine = draft.topics.length ? draft.topics.join(", ") : "Choose the most relevant topics dynamically.";
  const toneLine = {
    warm: "be friendly and encouraging while staying structured",
    balanced: "be calm, concise, and rigorous",
    rigorous: "be direct, thorough, and precise",
  }[draft.tone];

  return draft.system_instruction.trim() || [
    `You are ${draft.name || "an interviewer"} conducting a ${difficultyMeta[draft.difficulty].label.toLowerCase()} ${agentTypeMeta[draft.interview_type].label.toLowerCase()} interview for a ${draft.job_title || "target role"} at ${draft.company_name || "the company"}.`,
    `Your job is to evaluate the candidate's fit, ask one question at a time, and keep the pace conversational.`,
    `Interview focus: ${topicLine}`,
    `Style: ${toneLine}.`,
    `Use ${draft.language.toUpperCase()} and stop after ${draft.max_questions} questions or once you have enough evidence to evaluate the candidate.`,
    "At the end, summarize strengths, gaps, and a hiring recommendation without exposing hidden rubric details.",
  ].join(" ");
}
