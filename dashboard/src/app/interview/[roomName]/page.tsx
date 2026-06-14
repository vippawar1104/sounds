"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { RoomEvent } from "livekit-client";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Mic,
  MicOff,
  PanelLeft,
  PhoneOff,
  Send,
  Sparkles,
  Users2,
} from "lucide-react";
import {
  AgentRecord,
  agentTypeMeta,
  apiUrl,
  fmtDate,
  fmtSeconds,
} from "@/lib/interview-platform";

interface SessionData {
  token: string;
  livekitUrl: string;
  agent: AgentRecord;
  sessionId?: number;
}

interface TranscriptMessage {
  type: "transcript";
  speaker?: string;
  text: string;
  is_partial?: boolean;
}

interface ChatLine {
  speaker: string;
  text: string;
  time: string;
}

function parseTranscriptMessage(value: unknown): TranscriptMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "transcript" || typeof message.text !== "string") return null;
  return {
    type: "transcript",
    speaker: typeof message.speaker === "string" ? message.speaker : undefined,
    text: message.text,
    is_partial: Boolean(message.is_partial),
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function saveTranscriptLine(sessionId: number | undefined, speaker: string, text: string) {
  if (!sessionId || !text.trim()) return;
  try {
    await fetch(apiUrl(`/sessions/${sessionId}/transcript`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speaker,
        text: text.trim(),
        source: "live",
      }),
    });
  } catch (error) {
    console.error("Failed to save transcript line:", error);
  }
}

function Workspace({
  session,
  onLeave,
}: {
  session: SessionData;
  onLeave: (duration: number) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);

  const interviewMeta = agentTypeMeta[session.agent.interview_type] ?? agentTypeMeta.technical;
  const botConnected = participants.some((participant) => participant.identity !== localParticipant?.identity);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDuration((current) => {
        const next = current + 1;
        durationRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    if (!room) return;

    const handler = (payload: Uint8Array, participant: { identity: string } | undefined) => {
      try {
        const decoded = parseTranscriptMessage(JSON.parse(new TextDecoder().decode(payload)));
        if (!decoded) return;

        const speaker =
          decoded.speaker === "user"
            ? "Candidate"
            : decoded.speaker === "assistant"
              ? session.agent.name
              : participant?.identity === "user"
                ? "Candidate"
                : session.agent.name;
        const text = decoded.text.trim();
        if (!text) return;

        const now = new Date();
        const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (!decoded.is_partial) {
          void saveTranscriptLine(
            session.sessionId,
            speaker === "Candidate" ? "candidate" : "agent",
            text,
          );
        }

        // Show typing indicator when agent starts speaking
        if (speaker === session.agent.name && decoded.is_partial) {
          setAgentTyping(true);
        }

        setTranscript((current) => {
          // Hide typing indicator once we have actual content
          if (speaker === session.agent.name && text) {
            setAgentTyping(false);
          }

          if (decoded.is_partial && current.length > 0 && current[current.length - 1].speaker === speaker) {
            const next = [...current];
            next[next.length - 1] = {
              ...next[next.length - 1],
              text: `${next[next.length - 1].text}${text}`,
            };
            return next;
          }

          if (!decoded.is_partial && current.length > 0 && current[current.length - 1].speaker === speaker) {
            const next = [...current];
            next[next.length - 1] = {
              ...next[next.length - 1],
              text,
            };
            return next;
          }

          return [...current, { speaker, text, time }];
        });
      } catch {
        // Ignore non-transcript payloads.
      }
    };

    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, session.agent.name, session.sessionId]);

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    const nextMuted = !muted;
    await localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }, [localParticipant, muted]);

  const submitText = useCallback(async () => {
    if (!message.trim() || !room) return;
    const text = message.trim();
    setMessage("");
    setSending(true);

    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    
    // Add to transcript immediately
    setTranscript((current) => [...current, { speaker: "Candidate", text, time }]);
    void saveTranscriptLine(session.sessionId, "candidate", text);

    // Send as data message to the room so the agent can process it
    try {
      await room.localParticipant.publishData(
        JSON.stringify({
          type: "text_input",
          text: text,
        }),
        { reliable: true }
      );
    } catch (error) {
      console.error("Failed to send text message:", error);
    } finally {
      setSending(false);
    }
  }, [message, room, session.sessionId]);

  const endInterview = useCallback(() => onLeave(durationRef.current), [onLeave]);

  const participantCount = participants.length;
  const topMetrics = [
    { label: "Elapsed", value: fmtSeconds(duration) },
    { label: "Participants", value: String(participantCount) },
    { label: "Transcript", value: String(transcript.length) },
  ];

  const status = useMemo(() => {
    return botConnected ? "Agent connected" : "Waiting for agent";
  }, [botConnected]);

  return (
    <div className="flex min-h-screen flex-col bg-[#070b10] text-[#eef2f5]">
      <RoomAudioRenderer />

      <header className="border-b border-white/10 bg-[#070b10]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={endInterview}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#eef2f5] hover:bg-white/8"
            >
              <ArrowLeft size={15} />
              Leave room
            </button>
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-[0.2em] text-[#8190a1]">Live interview room</p>
              <h1 className="truncate text-lg font-semibold text-[#f6f8fb]">{session.agent.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              <Sparkles size={13} />
              {interviewMeta.label}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[#b8c3ce]">
              <Clock3 size={13} />
              {fmtSeconds(duration)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:px-8">
        <aside className="space-y-4">
          <section className="glass-panel rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Session status</p>
                <h2 className="mt-2 text-xl font-semibold text-[#f6f8fb]">{status}</h2>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: interviewMeta.soft, color: interviewMeta.accent }}
              >
                <Mic size={20} />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {topMetrics.map((metric) => (
                <div key={metric.label} className="surface rounded-2xl px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">{metric.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[#f5f8fa]">{metric.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <Users2 size={14} />
              Participants
            </div>
            <div className="mt-4 space-y-3">
              {participants.map((participant) => {
                const isHuman = participant.identity === "user";
                return (
                  <div key={participant.identity} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-sm font-semibold text-[#f5f8fa]">
                      {isHuman ? "C" : initials(session.agent.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#eef2f5]">{isHuman ? "Candidate" : session.agent.name}</p>
                      <p className="truncate text-[12px] text-[#8ea0b2]">{participant.identity}</p>
                    </div>
                    {participant.isSpeaking ? (
                      <span className="ml-auto flex items-end gap-1">
                        <span className="h-2 w-1 rounded-full bg-[#57d18c]" />
                        <span className="h-3 w-1 rounded-full bg-[#57d18c]" />
                        <span className="h-4 w-1 rounded-full bg-[#57d18c]" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="surface rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <PanelLeft size={14} />
              Interview details
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Job title</span>
                <span className="text-right font-medium text-[#eef2f5]">{session.agent.job_title || "Unset"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Company</span>
                <span className="text-right font-medium text-[#eef2f5]">{session.agent.company_name || "Unset"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Created</span>
                <span className="text-right font-medium text-[#eef2f5]">{fmtDate(session.agent.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Agent type</span>
                <span className="text-right font-medium text-[#eef2f5]">{session.agent.interview_type}</span>
              </div>
            </div>
          </section>
        </aside>

        <section className="glass-panel flex min-h-[70vh] flex-col overflow-hidden rounded-[28px]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Transcript</p>
              <h2 className="mt-1 text-lg font-semibold text-[#f6f8fb]">Conversation feed</h2>
            </div>
            <div className="text-sm text-[#8ea0b2]">{transcript.length} entries</div>
          </div>

          <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
            {transcript.length === 0 ? (
              <div className="flex h-full min-h-[30rem] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-[#57d18c]">
                  <Sparkles size={24} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-[#f6f8fb]">Transcript appears here</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[#8ea0b2]">
                  As the room starts streaming audio, partial and final transcript messages will accumulate here in
                  the order they arrive.
                </p>
              </div>
            ) : (
              transcript.map((line, index) => {
                const isCandidate = line.speaker === "Candidate";
                const isSystem = line.speaker === "System";
                return (
                  <div key={`${line.speaker}-${index}`} className={`flex ${isCandidate ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[76%] ${isCandidate ? "text-right" : "text-left"}`}>
                      <div className="mb-1 flex items-center gap-2 text-[12px] text-[#8190a1]">
                        <span className="font-medium text-[#eef2f5]">{line.speaker}</span>
                        <span>{line.time}</span>
                      </div>
                      <div
                        className={`rounded-[22px] border px-4 py-3 text-sm leading-7 ${
                          isSystem
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : isCandidate
                              ? "border-[#57d18c]/20 bg-[#57d18c]/12 text-[#eef2f5]"
                              : "border-white/10 bg-white/5 text-[#eef2f5]"
                        }`}
                      >
                        {line.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {agentTyping && (
              <div className="flex justify-start">
                <div className="max-w-[76%] text-left">
                  <div className="mb-1 flex items-center gap-2 text-[12px] text-[#8190a1]">
                    <span className="font-medium text-[#eef2f5]">{session.agent.name}</span>
                    <span>typing...</span>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#57d18c]" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#57d18c]" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#57d18c]" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitText();
                  }
                }}
                placeholder="Type your answer here (or use your microphone)"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#eef2f5] placeholder:text-[#8190a1]"
              />
              <button
                onClick={submitText}
                disabled={!message.trim() || sending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-panel rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8190a1]">Controls</p>
                <h2 className="mt-2 text-xl font-semibold text-[#f6f8fb]">Session actions</h2>
              </div>
              <PhoneOff size={18} className="text-[#f87171]" />
            </div>
            <div className="mt-5 grid gap-3">
              <button
                onClick={toggleMic}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${
                  muted
                    ? "border border-red-400/20 bg-red-400/10 text-red-200"
                    : "border border-white/10 bg-white/5 text-[#eef2f5]"
                }`}
              >
                {muted ? <MicOff size={16} /> : <Mic size={16} />}
                {muted ? "Unmute mic" : "Mute mic"}
              </button>
              <button
                onClick={endInterview}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f87171] px-4 py-3 text-sm font-semibold text-white"
              >
                <PhoneOff size={16} />
                End interview
              </button>
            </div>
          </section>

          <section className="surface rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <Sparkles size={14} />
              Room details
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Room</span>
                <span className="font-medium text-[#eef2f5]">{session.livekitUrl ? "Connected" : "Offline"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Session ID</span>
                <span className="font-medium text-[#eef2f5]">{session.sessionId ?? "Draft"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Status</span>
                <span className="font-medium text-[#eef2f5]">{botConnected ? "Live" : "Connecting"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8ea0b2]">Participants</span>
                <span className="font-medium text-[#eef2f5]">{participantCount}</span>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const roomName = params.roomName as string;
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`interview_${roomName}`);
    if (!raw) {
      setError("This interview session is missing. Launch an agent from the library first.");
      return;
    }
    try {
      setSession(JSON.parse(raw) as SessionData);
    } catch {
      setError("The stored session metadata is invalid.");
    }
  }, [roomName]);

  const endInterview = useCallback(
    async (duration: number) => {
      if (!session) {
        router.push("/library");
        return;
      }

      if (session.sessionId) {
        try {
          await fetch(apiUrl(`/sessions/${session.sessionId}/end`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_seconds: duration }),
          });
        } catch {
          // Keep the UI flow moving even if persistence fails.
        }
      }

      sessionStorage.removeItem(`interview_${roomName}`);
      setFinished(true);
      router.push("/library");
    },
    [roomName, router, session],
  );

  if (finished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b10]">
        <div className="glass-panel rounded-[28px] px-8 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#57d18c]/12 text-[#57d18c]">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-[#f6f8fb]">Interview ended</h2>
          <p className="mt-3 text-sm text-[#8ea0b2]">Returning to the agent library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b10] px-6">
        <div className="glass-panel max-w-lg rounded-[28px] px-8 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <PhoneOff size={26} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-[#f6f8fb]">Session error</h2>
          <p className="mt-3 text-sm leading-7 text-[#8ea0b2]">{error}</p>
          <button
            onClick={() => router.push("/library")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b]"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b10]">
        <div className="flex items-center gap-3 text-[#8ea0b2]">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#57d18c]" />
          Loading room...
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.livekitUrl}
      connect
      audio
      video={false}
      style={{ height: "100vh" }}
      onDisconnected={() => endInterview(0)}
    >
      <Workspace session={session} onLeave={endInterview} />
    </LiveKitRoom>
  );
}
