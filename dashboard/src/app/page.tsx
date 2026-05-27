"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Stats {
  total_agents: number;
  total_sessions: number;
  completed_sessions: number;
  avg_duration_seconds: number | null;
}
interface Session {
  id: number;
  room_name: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
}

function fmt(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function Overview() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/stats").then(r => r.ok ? r.json() : null),
      fetch("http://localhost:8000/sessions").then(r => r.ok ? r.json() : []),
    ]).then(([s, sess]) => { setStats(s); setSessions(sess ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const rate = stats && stats.total_sessions > 0
    ? Math.round((stats.completed_sessions / stats.total_sessions) * 100) : null;

  const statItems = [
    { label: "Total Agents",    value: loading ? "—" : String(stats?.total_agents ?? 0),   sub: "Configured" },
    { label: "Sessions",        value: loading ? "—" : String(stats?.total_sessions ?? 0),  sub: "Interviews started" },
    { label: "Completion Rate", value: loading ? "—" : (rate !== null ? `${rate}%` : "—"),  sub: stats ? `${stats.completed_sessions} completed` : "No data" },
    { label: "Avg Duration",    value: loading ? "—" : fmt(stats?.avg_duration_seconds ?? null), sub: "Per interview" },
  ];

  return (
    <div className="max-w-4xl space-y-12">
      {/* Hero */}
      <div className="pt-4 space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#4ade80]">
          Interview Platform
        </p>
        <h1 className="text-5xl font-bold tracking-tight leading-[1.1] text-white">
          AI interviews,<br />done right.
        </h1>
        <p className="text-[#6b6b6b] text-base max-w-md leading-relaxed">
          Create voice AI agents that conduct real interviews. Powered by Pipecat and LiveKit.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => router.push("/create-agent")}
            className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors">
            Create Agent
          </button>
          <button onClick={() => router.push("/library")}
            className="px-5 py-2.5 rounded-full border border-[#2a2a2a] text-[#d4d4d4] text-sm font-medium hover:border-[#3a3a3a] hover:text-white transition-colors">
            View Agents
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statItems.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4b4b4b] mb-3">{s.label}</p>
            <p className="text-3xl font-bold tracking-tight text-white tabular-nums">{s.value}</p>
            <p className="text-[11px] text-[#4b4b4b] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4b4b4b] mb-4">Get Started</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: "/create-agent", title: "Create Agent", desc: "Configure a new AI interviewer with custom persona, topics, and voice." },
            { href: "/library",      title: "Start Interview", desc: "Select an agent and begin a live voice interview session instantly." },
            { href: "/library",      title: "Manage Agents", desc: "View, update, or remove your configured interview agents." },
          ].map((item) => (
            <Link key={item.title} href={item.href}
              className="group p-5 rounded-xl border border-[#1f1f1f] bg-[#111111] hover:border-[#2a2a2a] hover:bg-[#141414] transition-all duration-150 block">
              <h3 className="font-semibold text-sm text-white mb-2 group-hover:text-[#4ade80] transition-colors">{item.title}</h3>
              <p className="text-[12px] text-[#5a5a5a] leading-relaxed">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Sessions table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4b4b4b]">Recent Sessions</p>
          <Link href="/library" className="text-[11px] text-[#4b4b4b] hover:text-[#d4d4d4] transition-colors">View all</Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5 space-y-2.5">
            {[1,2,3].map(i => <div key={i} className="h-8 bg-[#1a1a1a] rounded-lg animate-pulse" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-12 text-center">
            <p className="text-sm font-medium text-white mb-1">No sessions yet</p>
            <p className="text-[12px] text-[#4b4b4b] mb-5">Start your first interview to see history here.</p>
            <button onClick={() => router.push("/library")}
              className="px-4 py-2 rounded-full border border-[#2a2a2a] text-[#d4d4d4] text-xs font-medium hover:border-[#3a3a3a] hover:text-white transition-colors">
              Go to Agents
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  {["Room", "Status", "Duration", "Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4b4b4b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 8).map((s) => (
                  <tr key={s.id} className="border-b border-[#161616] last:border-0 hover:bg-[#141414] transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-[#5a5a5a] truncate max-w-[180px]">{s.room_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        s.status === "completed" ? "bg-[#14532d] text-[#4ade80]" :
                        s.status === "active"    ? "bg-[#1e3a5f] text-[#60a5fa]" :
                        "bg-[#1a1a1a] text-[#5a5a5a]"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${s.status === "completed" ? "bg-[#4ade80]" : s.status === "active" ? "bg-[#60a5fa] animate-pulse" : "bg-[#5a5a5a]"}`} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#5a5a5a]">{fmt(s.duration_seconds)}</td>
                    <td className="px-4 py-3 text-[12px] text-[#5a5a5a]">
                      {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
