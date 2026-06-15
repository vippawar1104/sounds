"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Mic,
  PanelTop,
  Plus,
  Settings2,
  Sparkles,
  SquarePlay,
  TimerReset,
  Users2,
} from "lucide-react";
import {
  AgentRecord,
  SessionRecord,
  StatsSnapshot,
  agentTypeMeta,
  fetchJson,
  fmtDate,
  fmtSeconds,
  mockAgents,
  mockSessions,
  mockStats,
  sessionStatusMeta,
} from "@/lib/interview-platform";

const actionCards = [
  {
    title: "Create interviewer",
    description: "Set tone, rubric, role, and model defaults for a new interview agent.",
    href: "/create-agent",
    icon: Plus,
  },
  {
    title: "Open agent library",
    description: "Browse active interviewer templates and launch sessions from one place.",
    href: "/library",
    icon: Bot,
  },
  {
    title: "Review sessions",
    description: "Inspect transcripts, turn timing, and final evaluations after each room closes.",
    href: "/library",
    icon: PanelTop,
  },
];

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users2;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#8090a0]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#f5f8fa]">{value}</p>
          <p className="mt-1 text-sm text-[#8ea0b2]">{detail}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#57d18c]">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = sessionStatusMeta[status] ?? sessionStatusMeta.connecting;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: meta.soft, borderColor: meta.accent + "33", color: meta.accent }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
      {meta.label}
    </span>
  );
}

function fmtRate(stats: StatsSnapshot | null) {
  if (!stats || stats.total_sessions === 0) return "0%";
  return `${Math.round((stats.completed_sessions / stats.total_sessions) * 100)}%`;
}

export default function Overview() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetchJson<StatsSnapshot>("/stats"),
      fetchJson<SessionRecord[]>("/sessions"),
      fetchJson<AgentRecord[]>("/agents"),
    ]).then(([statsRes, sessionsRes, agentsRes]) => {
      if (!alive) return;

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      } else {
        setStats(mockStats);
        setConnected(false);
      }

      if (sessionsRes.status === "fulfilled") {
        setSessions(sessionsRes.value);
      } else {
        setSessions(mockSessions);
        setConnected(false);
      }

      if (agentsRes.status === "fulfilled") {
        setAgents(agentsRes.value);
      } else {
        setAgents(mockAgents);
        setConnected(false);
      }

      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active" || s.status === "connecting"), [sessions]);
  const completionRate = fmtRate(stats);
  const systemModel = [
    { label: "STT", value: "ElevenLabs Scribe", state: "ready" },
    { label: "LLM", value: "Claude Haiku", state: "ready" },
    { label: "TTS", value: "ElevenLabs voices", state: "ready" },
    { label: "Plane", value: connected ? "Backend online" : "Demo data", state: connected ? "ready" : "offline" },
  ] as const;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <section className="glass-panel overflow-hidden rounded-[28px]">
        <div className="grid gap-8 p-7 lg:grid-cols-[1.25fr_0.75fr] lg:p-9">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ea0b2]">
                <Sparkles size={13} />
                Interview platform
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                <CircleDashed size={13} />
                {connected ? "Backend connected" : "Demo mode"}
              </span>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-[#f6f8fb] lg:text-5xl">
                Run interviewer agents that sound prepared, structured, and real.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#8ea0b2]">
                Configure agents, launch LiveKit sessions, and review transcripts in a dashboard built for
                interview operations rather than a generic chatbot UI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/create-agent")}
                className="inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b] shadow-[0_14px_34px_rgba(87,209,140,0.2)] hover:translate-y-[-1px]"
              >
                Create agent
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => router.push("/library")}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#eef2f5] hover:bg-white/8"
              >
                Open library
                <Bot size={16} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {actionCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="surface group rounded-2xl p-4 hover:border-white/20 hover:bg-white/6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#57d18c]">
                        <Icon size={17} />
                      </div>
                      <ArrowRight size={15} className="text-[#8ea0b2] transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <h2 className="mt-6 text-sm font-semibold text-[#f5f8fa]">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#8ea0b2]">{card.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8090a0]">System stack</p>
                  <p className="mt-1 text-lg font-semibold text-[#f5f8fa]">Realtime pipeline</p>
                </div>
                <Mic size={18} className="text-[#57d18c]" />
              </div>
              <div className="mt-5 space-y-3">
                {systemModel.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8090a0]">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-[#f5f8fa]">{item.value}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        background: item.state === "offline" ? "rgba(248,113,113,0.12)" : "rgba(87,209,140,0.12)",
                        color: item.state === "offline" ? "#f87171" : "#57d18c",
                      }}
                    >
                      {item.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8090a0]">Activity</p>
                  <p className="mt-1 text-lg font-semibold text-[#f5f8fa]">Current room state</p>
                </div>
                <CalendarClock size={18} className="text-[#8ea0b2]" />
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8ea0b2]">Active sessions</span>
                  <span className="font-semibold text-[#f5f8fa]">{stats?.active_sessions ?? activeSessions.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8ea0b2]">Completion rate</span>
                  <span className="font-semibold text-[#f5f8fa]">{completionRate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8ea0b2]">Avg. interview length</span>
                  <span className="font-semibold text-[#f5f8fa]">{fmtSeconds(stats?.avg_duration_seconds ?? null)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Agents" value={loading ? "—" : String(stats?.total_agents ?? agents.length)} detail="Configured templates" icon={Users2} />
        <MetricCard label="Sessions" value={loading ? "—" : String(stats?.total_sessions ?? sessions.length)} detail="Interview rooms created" icon={SquarePlay} />
        <MetricCard label="Completed" value={loading ? "—" : String(stats?.completed_sessions ?? sessions.filter((s) => s.status === "completed").length)} detail="Finished interviews" icon={CheckCircle2} />
        <MetricCard label="Duration" value={loading ? "—" : fmtSeconds(stats?.avg_duration_seconds ?? null)} detail="Average session length" icon={TimerReset} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8090a0]">Recent sessions</p>
              <h2 className="mt-2 text-xl font-semibold text-[#f5f8fa]">What the platform is doing right now</h2>
            </div>
            <button
              onClick={() => router.push("/library")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#eef2f5] hover:bg-white/8"
            >
              View library
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full">
              <thead className="bg-white/4">
                <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[#8090a0]">
                  <th className="px-4 py-3 font-semibold">Room</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? mockSessions : sessions).slice(0, 5).map((session) => (
                  <tr key={session.id} className="border-t border-white/8 text-sm text-[#eef2f5]">
                    <td className="px-4 py-4 font-mono text-[12px] text-[#b8c3ce]">{session.room_name}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{session.agent_name ?? "Unknown"}</div>
                      <div className="text-[12px] text-[#8ea0b2]">{session.candidate_name ?? "Candidate"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={session.status} />
                    </td>
                    <td className="px-4 py-4 text-[#b8c3ce]">{fmtSeconds(session.duration_seconds)}</td>
                    <td className="px-4 py-4 text-[#b8c3ce]">{fmtDate(session.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8090a0]">Agent roster</p>
              <h2 className="mt-2 text-xl font-semibold text-[#f5f8fa]">Configured interviewers</h2>
            </div>
            <Settings2 size={18} className="text-[#8ea0b2]" />
          </div>

          <div className="mt-5 space-y-3">
            {(loading ? mockAgents : agents).slice(0, 3).map((agent) => {
              const type = agentTypeMeta[agent.interview_type];
              return (
                <div key={agent.id} className="surface rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#f5f8fa]">{agent.name}</p>
                      <p className="mt-1 text-sm text-[#8ea0b2]">{agent.role}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: type.soft, color: type.accent }}>
                      {type.label}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-[#b8c3ce]">
                      {agent.job_title ?? "Role-agnostic"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-[#b8c3ce]">
                      {agent.max_questions} questions
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-[#b8c3ce] uppercase">
                      {agent.language}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
