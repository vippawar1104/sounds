"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: number; name: string; role: string; language: string;
  llm_model: string; tts_model: string; interview_type: string;
  difficulty: string; job_title: string | null; company_name: string | null;
  topics: string[] | null; max_questions: number; created_at: string;
}

const TYPE: Record<string, { label: string; color: string; bg: string }> = {
  technical:  { label: "Technical",    color: "text-violet-400",  bg: "bg-violet-400/10" },
  behavioral: { label: "Behavioral",   color: "text-amber-400",   bg: "bg-amber-400/10"  },
  hr:         { label: "HR Screening", color: "text-[#4ade80]",   bg: "bg-[#4ade80]/10"  },
};
const DIFF: Record<string, string> = { junior: "Junior", mid: "Mid-level", senior: "Senior" };

function Initials({ name }: { name: string }) {
  return <>{name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}</>;
}

function DeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-semibold text-white mb-2">Delete Agent</h3>
        <p className="text-[13px] text-[#6b6b6b] mb-5">
          Delete <span className="text-white font-medium">{name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-[13px] font-medium text-[#d4d4d4] hover:bg-[#1a1a1a] transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentLibrary() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchAgents = useCallback(() => {
    setLoading(true);
    fetch("http://localhost:8000/agents")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setAgents(d); setLoading(false); })
      .catch(() => { setError("Could not connect to backend on port 8000."); setLoading(false); });
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const startInterview = async (agentId: number) => {
    setStartingId(agentId);
    try {
      const res = await fetch(`http://localhost:8000/agents/${agentId}/join-room`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      sessionStorage.setItem(`interview_${data.room_name}`, JSON.stringify({
        token: data.user_token, livekitUrl: data.livekit_url,
        agent: data.agent, sessionId: data.session_id,
      }));
      router.push(`/interview/${data.room_name}`);
    } catch { alert("Failed to start interview. Check that the backend is running."); }
    finally { setStartingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`http://localhost:8000/agents/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null); fetchAgents();
  };

  const filtered = filter === "all" ? agents : agents.filter(a => a.interview_type === filter);

  return (
    <div className="max-w-5xl space-y-8">
      {deleteTarget && <DeleteModal name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#4ade80] mb-2">Voice AI</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Interview Agents</h1>
          <p className="text-[#6b6b6b] text-sm mt-1">Select an agent to start a live voice interview.</p>
        </div>
        <button onClick={() => router.push("/create-agent")}
          className="px-4 py-2 rounded-full bg-white text-black text-[13px] font-semibold hover:bg-[#e5e5e5] transition-colors flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2.5" strokeLinecap="round" d="M12 4v16m8-8H4" />
          </svg>
          New Agent
        </button>
      </div>

      {/* Filter tabs */}
      {!loading && agents.length > 0 && (
        <div className="flex items-center gap-1 border-b border-[#1f1f1f]">
          {[
            { key: "all",        label: `All  ${agents.length}` },
            { key: "technical",  label: `Technical  ${agents.filter(a => a.interview_type === "technical").length}` },
            { key: "behavioral", label: `Behavioral  ${agents.filter(a => a.interview_type === "behavioral").length}` },
            { key: "hr",         label: `HR  ${agents.filter(a => a.interview_type === "hr").length}` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-2.5 text-[12px] font-medium transition-all border-b-2 -mb-px ${
                filter === f.key ? "border-white text-white" : "border-transparent text-[#5a5a5a] hover:text-[#d4d4d4]"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-400">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1a]" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
                  <div className="h-2.5 bg-[#1a1a1a] rounded w-1/3" />
                </div>
              </div>
              <div className="h-2.5 bg-[#1a1a1a] rounded w-full" />
              <div className="h-9 bg-[#1a1a1a] rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl border border-[#1f1f1f] bg-[#111111] flex items-center justify-center mb-4">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-[#4b4b4b]">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
            </svg>
          </div>
          <p className="font-semibold text-sm text-white">{filter === "all" ? "No agents yet" : `No ${filter} agents`}</p>
          <p className="text-[12px] text-[#5a5a5a] mt-1 mb-5">
            {filter === "all" ? "Create your first interview agent to get started." : "Try a different filter or create a new agent."}
          </p>
          {filter === "all" && (
            <button onClick={() => router.push("/create-agent")}
              className="px-4 py-2 rounded-full bg-white text-black text-[13px] font-semibold hover:bg-[#e5e5e5] transition-colors">
              Create Agent
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(agent => {
            const tc = TYPE[agent.interview_type] ?? TYPE.technical;
            const isStarting = startingId === agent.id;
            return (
              <div key={agent.id} className="group relative rounded-xl border border-[#1f1f1f] bg-[#111111] hover:border-[#2a2a2a] transition-all duration-150 flex flex-col overflow-hidden">
                <div className="p-5 flex flex-col flex-1 gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg ${tc.bg} flex items-center justify-center font-semibold text-xs ${tc.color} flex-shrink-0`}>
                        <Initials name={agent.name} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-[14px] text-white truncate">{agent.name}</h2>
                        <p className="text-[11px] text-[#5a5a5a] truncate">{agent.role}</p>
                      </div>
                    </div>
                    <button onClick={() => setDeleteTarget(agent)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 text-[#4b4b4b] hover:text-red-400 transition-all flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Job context */}
                  {(agent.job_title || agent.company_name) && (
                    <div className="text-[11px] text-[#5a5a5a] bg-[#161616] border border-[#1f1f1f] rounded-md px-3 py-1.5 truncate font-mono">
                      {agent.job_title && <span className="text-[#d4d4d4]">{agent.job_title}</span>}
                      {agent.job_title && agent.company_name && <span className="mx-1.5 text-[#3a3a3a]">/</span>}
                      {agent.company_name && <span>{agent.company_name}</span>}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${tc.bg} ${tc.color}`}>{tc.label}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1a1a1a] text-[#6b6b6b]">{DIFF[agent.difficulty] ?? agent.difficulty}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1a1a1a] text-[#6b6b6b] uppercase">{agent.language}</span>
                  </div>

                  {/* Topics */}
                  {agent.topics && agent.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {agent.topics.slice(0, 3).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full border border-[#1f1f1f] text-[10px] text-[#5a5a5a]">{t}</span>
                      ))}
                      {agent.topics.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full border border-[#1f1f1f] text-[10px] text-[#5a5a5a]">+{agent.topics.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="border-t border-[#1a1a1a] mt-auto" />

                  <div className="flex items-center justify-between text-[11px] text-[#4b4b4b]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                      Ready · {agent.max_questions}Q
                    </div>
                    <span>{agent.created_at ? new Date(agent.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                  </div>

                  <button onClick={() => startInterview(agent.id)} disabled={isStarting || startingId !== null}
                    className={`w-full py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
                      isStarting ? "bg-[#1a1a1a] text-[#5a5a5a] cursor-not-allowed" :
                      startingId !== null ? "bg-[#141414] text-[#4b4b4b] cursor-not-allowed" :
                      "bg-white text-black hover:bg-[#e5e5e5] active:scale-[0.99]"
                    }`}>
                    {isStarting ? (
                      <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Starting…</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>Start Interview</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
