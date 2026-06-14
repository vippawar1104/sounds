"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  FileText,
  Search,
  Sparkles,
  SquarePlay,
  X,
  WandSparkles,
} from "lucide-react";
import {
  AgentRecord,
  SessionRecord,
  TranscriptEntry,
  agentTypeMeta,
  apiUrl,
  fetchJson,
  fmtDate,
  fmtSeconds,
  mockAgents,
  mockSessions,
  sessionStatusMeta,
  difficultyMeta,
} from "@/lib/interview-platform";

const filterTabs = [
  { key: "all", label: "All" },
  { key: "technical", label: "Technical" },
  { key: "behavioral", label: "Behavioral" },
  { key: "screening", label: "Screening" },
] as const;

function AgentCard({
  agent,
  starting,
  onStart,
}: {
  agent: AgentRecord;
  starting: boolean;
  onStart: (id: number) => void;
}) {
  const type = agentTypeMeta[agent.interview_type];

  return (
    <div className="surface group flex flex-col rounded-[26px] p-5 hover:border-white/18 hover:bg-white/6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold"
              style={{ background: type.soft, color: type.accent }}
            >
              {agent.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#f5f8fa]">{agent.name}</h2>
              <p className="mt-1 text-sm text-[#8ea0b2]">{agent.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: type.soft, color: type.accent }}>
            {type.label}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[#b8c3ce]">
            {difficultyMeta[agent.difficulty].label}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase text-[#b8c3ce]">
            {agent.language}
          </span>
        </div>
        <p className="text-sm leading-6 text-[#8ea0b2]">{type.blurb}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Interview focus</p>
            <p className="mt-1 text-sm font-medium text-[#eef2f5]">{agent.job_title || "Role not set"}</p>
            <p className="text-sm text-[#8ea0b2]">{agent.company_name || "No company"} · {agent.max_questions} questions</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Created</p>
            <p className="mt-1 text-sm text-[#eef2f5]">{fmtDate(agent.created_at)}</p>
          </div>
        </div>
      </div>

      {agent.topics && agent.topics.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {agent.topics.slice(0, 4).map((topic) => (
            <span key={topic} className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-[#b8c3ce]">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <button
        onClick={() => onStart(agent.id)}
        disabled={starting}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#57d18c] px-4 py-3 text-sm font-semibold text-[#06110b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? "Starting..." : "Start interview"}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function SessionRow({
  session,
  onViewTranscript,
}: {
  session: SessionRecord;
  onViewTranscript: (session: SessionRecord) => void;
}) {
  const meta = sessionStatusMeta[session.status] ?? sessionStatusMeta.connecting;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/8 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#eef2f5]">{session.room_name}</p>
        <p className="mt-1 text-sm text-[#8ea0b2]">{session.agent_name || "Agent"} · {session.candidate_name || "Candidate"}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ background: meta.soft, borderColor: meta.accent + "33", color: meta.accent }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
          {meta.label}
        </span>
        <p className="mt-2 text-[12px] text-[#8ea0b2]">{fmtSeconds(session.duration_seconds)}</p>
        <button
          onClick={() => onViewTranscript(session)}
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-[#b8c3ce] hover:bg-white/8"
        >
          <FileText size={12} />
          Transcript
        </button>
      </div>
    </div>
  );
}

export default function AgentLibrary() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [filter, setFilter] = useState<(typeof filterTabs)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [transcriptSession, setTranscriptSession] = useState<SessionRecord | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptEntry[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchJson<AgentRecord[]>("/agents"), fetchJson<SessionRecord[]>("/sessions")]).then(
      ([agentsRes, sessionsRes]) => {
        if (!alive) return;
        if (agentsRes.status === "fulfilled") {
          setAgents(agentsRes.value);
        } else {
          setAgents(mockAgents);
          setConnected(false);
        }
        if (sessionsRes.status === "fulfilled") {
          setSessions(sessionsRes.value);
        } else {
          setSessions(mockSessions);
          setConnected(false);
        }
        setLoading(false);
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesFilter = filter === "all" ? true : agent.interview_type === filter;
      const matchesQuery =
        !q ||
        agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q) ||
        (agent.job_title ?? "").toLowerCase().includes(q) ||
        (agent.company_name ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [agents, filter, query]);

  const visibleSessions = sessions.slice(0, 4);

  const viewTranscript = async (session: SessionRecord) => {
    setTranscriptSession(session);
    setTranscriptLines([]);
    setTranscriptLoading(true);
    try {
      const rows = await fetchJson<TranscriptEntry[]>(`/sessions/${session.id}/transcript`);
      setTranscriptLines(rows);
    } catch {
      setTranscriptLines([]);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const startInterview = async (agentId: number) => {
    setStartingId(agentId);
    try {
      const res = await fetch(apiUrl(`/agents/${agentId}/join-room`), { method: "POST" });
      if (!res.ok) {
        throw new Error("join-room failed");
      }
      const data = (await res.json()) as {
        room_name: string;
        user_token: string;
        livekit_url: string;
        agent: AgentRecord;
        session_id: number;
      };
      sessionStorage.setItem(
        `interview_${data.room_name}`,
        JSON.stringify({
          token: data.user_token,
          livekitUrl: data.livekit_url,
          agent: data.agent,
          sessionId: data.session_id,
        }),
      );
      router.push(`/interview/${data.room_name}`);
    } catch {
      window.alert("Could not start the room. Make sure the backend is running on port 8000.");
    } finally {
      setStartingId(null);
    }
  };

  const counts = {
    all: agents.length,
    technical: agents.filter((agent) => agent.interview_type === "technical").length,
    behavioral: agents.filter((agent) => agent.interview_type === "behavioral").length,
    screening: agents.filter((agent) => agent.interview_type === "screening").length,
  };

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
      <section className="glass-panel rounded-[28px] p-7 lg:p-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ea0b2]">
            <Bot size={13} />
            Agent library
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#57d18c]/20 bg-[#57d18c]/12 px-3 py-1 text-[11px] font-semibold text-[#9af0bf]">
            <Sparkles size={13} />
            {connected ? "Backend connected" : "Demo data"}
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-[#f6f8fb] lg:text-5xl">
              Find an interviewer, tune it, and launch a room.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[#8ea0b2]">
              Each card maps to a configurable LiveKit participant backed by Claude Haiku and ElevenLabs.
            </p>
          </div>
          <button
            onClick={() => router.push("/create-agent")}
            className="inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b]"
          >
            Create agent
            <WandSparkles size={16} />
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {filterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-2xl border px-4 py-4 text-left ${
                active
                  ? "border-[#57d18c]/50 bg-[#57d18c]/12"
                  : "border-white/10 bg-white/4 hover:bg-white/6"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">{tab.label}</div>
              <div className="mt-2 text-2xl font-semibold text-[#f5f8fa]">{counts[tab.key]}</div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="surface flex flex-col gap-4 rounded-[26px] p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8190a1]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents by name, role, job title, or company"
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[#eef2f5] placeholder:text-[#8190a1]"
              />
            </div>
            <div className="text-sm text-[#8ea0b2]">
              {filteredAgents.length} visible · {startingId !== null ? "Launching room..." : "Ready"}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="surface rounded-[26px] p-5">
                  <div className="h-5 w-28 animate-pulse rounded-full bg-white/8" />
                  <div className="mt-4 h-10 animate-pulse rounded-2xl bg-white/8" />
                  <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/8" />
                </div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="glass-panel rounded-[26px] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-[#57d18c]">
                <Bot size={22} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-[#f6f8fb]">No agents match this filter</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#8ea0b2]">
                Broaden the search or create a new interviewer template.
              </p>
              <Link
                href="/create-agent"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b]"
              >
                Create agent
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  starting={startingId === agent.id}
                  onStart={startInterview}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass-panel rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Recent sessions</p>
                <h2 className="mt-2 text-xl font-semibold text-[#f6f8fb]">What just ran</h2>
              </div>
              <SquarePlay size={18} className="text-[#57d18c]" />
            </div>
            <div className="mt-4 space-y-2">
              {(loading ? mockSessions : visibleSessions).map((session) => (
                <SessionRow key={session.id} session={session} onViewTranscript={viewTranscript} />
              ))}
            </div>
          </div>

          <div className="surface rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Launch note</p>
                <h2 className="mt-2 text-lg font-semibold text-[#f6f8fb]">Runtime expectations</h2>
              </div>
              <Bot size={18} className="text-[#8ea0b2]" />
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#8ea0b2]">
              <li>• Each interview should map to one LiveKit room and one worker.</li>
              <li>• Keep the question count short enough for a natural voice loop.</li>
              <li>• Transcript and evaluation data should persist even if the room disconnects.</li>
            </ul>
          </div>
        </aside>
      </section>

      {transcriptSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
          <div className="glass-panel flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Transcript</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-[#f6f8fb]">{transcriptSession.room_name}</h2>
                <p className="mt-1 text-sm text-[#8ea0b2]">{transcriptSession.agent_name || "Agent"} · {fmtDate(transcriptSession.created_at)}</p>
              </div>
              <button
                onClick={() => setTranscriptSession(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#b8c3ce] hover:bg-white/8"
                aria-label="Close transcript"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {transcriptLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/8" />
                  ))}
                </div>
              ) : transcriptLines.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-[#8ea0b2]">
                  No transcript has been saved for this session yet.
                </div>
              ) : (
                transcriptLines.map((line, index) => {
                  const isCandidate = line.speaker === "candidate";
                  return (
                    <div key={line.id ?? index} className={`flex ${isCandidate ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] ${isCandidate ? "text-right" : "text-left"}`}>
                        <div className="mb-1 flex items-center gap-2 text-[12px] text-[#8190a1]">
                          <span className="font-medium text-[#eef2f5]">{isCandidate ? "Candidate" : transcriptSession.agent_name || "Agent"}</span>
                          <span>{line.created_at ? fmtDate(line.created_at) : line.time}</span>
                        </div>
                        <div className={`rounded-[22px] border px-4 py-3 text-sm leading-7 ${
                          isCandidate
                            ? "border-[#57d18c]/20 bg-[#57d18c]/12 text-[#eef2f5]"
                            : "border-white/10 bg-white/5 text-[#eef2f5]"
                        }`}>
                          {line.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
