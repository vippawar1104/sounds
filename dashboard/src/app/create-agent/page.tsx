"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Shared style tokens ───────────────────────────────────────────────────────
const inputCls =
  "mt-1 block w-full rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#4ade80]/30 focus:border-[#4ade80]/30 transition-colors";
const labelCls = "block text-sm font-medium text-muted-foreground";
const sectionCls = "rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentFormData {
  // Identity
  name: string;
  role: string;
  // Interview
  job_title: string;
  company_name: string;
  interview_type: string;
  difficulty: string;
  topics: string[];
  max_questions: number;
  system_instruction: string;
  // Voice
  language: string;
  tts_model: string;
  voice_id: string;
  // AI
  stt_model: string;
  llm_model: string;
  llm_temperature: number;
  vad_sensitivity: number;
}

const TOPIC_PRESETS: Record<string, string[]> = {
  technical: ["Data Structures", "Algorithms", "System Design", "OOP", "Databases", "APIs", "Cloud"],
  behavioral: ["Leadership", "Conflict Resolution", "Teamwork", "Adaptability", "Communication"],
  hr: ["Career Goals", "Salary Expectations", "Culture Fit", "Availability", "References"],
};

const STEPS = ["Interview Setup", "Agent Identity", "Voice & AI", "Review"];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              i < current ? "bg-[#4ade80] border-[#4ade80] text-black" :
              i === current ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10" :
              "border-[#1a1a1a] text-muted-foreground bg-transparent"
            }`}>
              {i < current ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i === current ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-3 mb-5 transition-colors ${i < current ? "bg-[#4ade80]" : "bg-[#1a1a1a]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Topic pill selector ───────────────────────────────────────────────────────
function TopicPills({ type, selected, onChange }: {
  type: string; selected: string[]; onChange: (t: string[]) => void;
}) {
  const presets = TOPIC_PRESETS[type] ?? TOPIC_PRESETS.technical;
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {presets.map((t) => (
        <button key={t} type="button" onClick={() => toggle(t)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            selected.includes(t)
              ? "bg-[#4ade80]/20 border-[#4ade80]/50 text-[#4ade80]"
              : "bg-transparent border-[#1a1a1a] text-muted-foreground hover:border-[#2a2a2a] hover:text-foreground"
          }`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Step 1: Interview Setup ───────────────────────────────────────────────────
function Step1({ data, set }: { data: AgentFormData; set: (k: keyof AgentFormData, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className={sectionCls}>
        <div className="mb-1">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Interview Context</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">Tell the agent what kind of interview to run.</p>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Job Title Being Interviewed For</label>
            <input type="text" className={inputCls} placeholder="e.g. Senior Frontend Engineer"
              value={data.job_title} onChange={(e) => set("job_title", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Company Name <span className="text-muted-foreground/50">(optional)</span></label>
            <input type="text" className={inputCls} placeholder="e.g. Acme Corp"
              value={data.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { value: "technical", label: "Technical", desc: "Coding & system design" },
            { value: "behavioral", label: "Behavioral", desc: "STAR-method questions" },
            { value: "hr", label: "HR Screening", desc: "Culture & fit" },
          ].map((opt) => (
            <button key={opt.value} type="button" onClick={() => { set("interview_type", opt.value); set("topics", []); }}
              className={`p-4 rounded-xl border text-left transition-all ${
                data.interview_type === opt.value
                  ? "border-[#4ade80]/50 bg-[#4ade80]/10"
                  : "border-[#1a1a1a] bg-[#0f0f0f] hover:border-[#2a2a2a]"
              }`}>
              <div className="font-semibold text-sm">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        <div>
          <label className={labelCls}>Difficulty Level</label>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { value: "junior", label: "Junior", sub: "0–2 yrs" },
              { value: "mid", label: "Mid-level", sub: "2–5 yrs" },
              { value: "senior", label: "Senior", sub: "5+ yrs" },
            ].map((d) => (
              <button key={d.value} type="button" onClick={() => set("difficulty", d.value)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                  data.difficulty === d.value
                    ? "border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80]"
                    : "border-[#1a1a1a] bg-[#0f0f0f] text-muted-foreground hover:text-foreground hover:border-[#2a2a2a]"
                }`}>
                {d.label}
                <span className="block text-xs font-normal opacity-60">{d.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Topics to Cover</label>
          <TopicPills type={data.interview_type} selected={data.topics} onChange={(t) => set("topics", t)} />
          <p className="text-xs text-muted-foreground mt-2">Click to toggle. Leave empty to let the agent decide.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Max Questions</label>
            <span className="text-sm font-mono font-bold text-[#4ade80]">{data.max_questions}</span>
          </div>
          <input type="range" min={3} max={20} step={1} className="w-full mt-2 accent-[#4ade80]"
            value={data.max_questions} onChange={(e) => set("max_questions", parseInt(e.target.value))} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>3</span><span>20</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Agent Identity ────────────────────────────────────────────────────
function Step2({ data, set }: { data: AgentFormData; set: (k: keyof AgentFormData, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className={sectionCls}>
        <div className="mb-1">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Agent Persona</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">Give your agent a name and role. The system prompt is auto-generated — or write your own.</p>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Agent Name</label>
            <input type="text" className={inputCls} placeholder="e.g. Alex"
              value={data.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Agent Title / Role</label>
            <input type="text" className={inputCls} placeholder="e.g. Senior Technical Interviewer"
              value={data.role} onChange={(e) => set("role", e.target.value)} required />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>System Prompt <span className="text-muted-foreground/50">(optional override)</span></label>
          </div>
          <textarea rows={6} className={inputCls}
            placeholder={`Leave blank to auto-generate from your interview settings.\n\nOr write a custom prompt:\n"You are Alex, a senior engineer at Acme Corp. Conduct a technical interview for a React developer role..."`}
            value={data.system_instruction}
            onChange={(e) => set("system_instruction", e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1.5">
            If left blank, a prompt is built automatically from Step 1 settings.
          </p>
        </div>
      </div>
    </div>
  );
}

const ELEVENLABS_VOICES = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger (Laid-back)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Mature)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (Quirky)" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie (Deep)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Warm)" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum (Husky)" },
];

const CARTESIA_VOICES = [
  { id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Female" },
  { id: "a0e99841-438c-4a64-b679-ae201e7d6091", name: "Soft Female" },
  { id: "b47908b9-1f8a-4933-9117-73d838383838", name: "Deep Male" },
];

// ── Step 3: Voice & AI ────────────────────────────────────────────────────────
function Step3({ data, set }: { data: AgentFormData; set: (k: keyof AgentFormData, v: unknown) => void }) {
  const voices = data.tts_model === "elevenlabs" ? ELEVENLABS_VOICES : CARTESIA_VOICES;

  return (
    <div className="space-y-6">
      <div className={sectionCls}>
        <div className="mb-1">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Voice Settings</h2>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className={labelCls}>Language</label>
            <select className={inputCls} value={data.language} onChange={(e) => set("language", e.target.value)}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>TTS Provider</label>
            <select className={inputCls} value={data.tts_model} onChange={(e) => {
              set("tts_model", e.target.value);
              set("voice_id", e.target.value === "elevenlabs" ? ELEVENLABS_VOICES[0].id : CARTESIA_VOICES[0].id);
            }}>
              <option value="cartesia">Cartesia</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Voice Preset</label>
            <select className={inputCls} value={data.voice_id} onChange={(e) => set("voice_id", e.target.value)}>
              {voices.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              <option value="custom">Custom ID...</option>
            </select>
          </div>
        </div>
        
        {data.voice_id === "custom" && (
          <div className="mt-4">
            <label className={labelCls}>Custom Voice ID</label>
            <input type="text" className={inputCls} placeholder="Enter ElevenLabs or Cartesia Voice ID"
              onChange={(e) => set("voice_id", e.target.value)} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>VAD Sensitivity</label>
            <span className="text-sm font-mono font-bold text-[#4ade80]">{data.vad_sensitivity.toFixed(1)}</span>
          </div>
          <input type="range" step="0.1" min="0.1" max="0.9" className="w-full mt-2 accent-[#4ade80]"
            value={data.vad_sensitivity} onChange={(e) => set("vad_sensitivity", parseFloat(e.target.value))} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Less sensitive</span><span>More sensitive</span></div>
        </div>
      </div>

      <div className={sectionCls}>
        <div className="mb-1">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">AI Model</h2>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>LLM Model</label>
            <select className={inputCls} value={data.llm_model} onChange={(e) => set("llm_model", e.target.value)}>
              <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Groq)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B — Fast (Groq)</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>STT Provider</label>
            <select className={inputCls} value={data.stt_model} onChange={(e) => set("stt_model", e.target.value)}>
              <option value="deepgram">Deepgram Nova</option>
              <option value="openai">Whisper (OpenAI)</option>
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Temperature</label>
            <span className="text-sm font-mono font-bold text-[#4ade80]">{data.llm_temperature.toFixed(1)}</span>
          </div>
          <input type="range" step="0.1" min="0" max="1" className="w-full mt-2 accent-[#4ade80]"
            value={data.llm_temperature} onChange={(e) => set("llm_temperature", parseFloat(e.target.value))} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Precise</span><span>Creative</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────────────────────
function Step4({ data }: { data: AgentFormData }) {
  const typeLabel: Record<string, string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR Screening" };
  const diffLabel: Record<string, string> = { junior: "Junior (0–2 yrs)", mid: "Mid-level (2–5 yrs)", senior: "Senior (5+ yrs)" };
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-[#1a1a1a] last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value || "—"}</span>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className={sectionCls}>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Interview</h2>
        <Row label="Job Title" value={data.job_title} />
        <Row label="Company" value={data.company_name} />
        <Row label="Type" value={typeLabel[data.interview_type] ?? data.interview_type} />
        <Row label="Difficulty" value={diffLabel[data.difficulty] ?? data.difficulty} />
        <Row label="Topics" value={data.topics.length ? data.topics.join(", ") : "Auto"} />
        <Row label="Max Questions" value={String(data.max_questions)} />
      </div>
      <div className={sectionCls}>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Agent</h2>
        <Row label="Name" value={data.name} />
        <Row label="Role" value={data.role} />
        <Row label="System Prompt" value={data.system_instruction ? "Custom" : "Auto-generated"} />
      </div>
      <div className={sectionCls}>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Voice & AI</h2>
        <Row label="Language" value={data.language.toUpperCase()} />
        <Row label="TTS" value={data.tts_model} />
        <Row label="Voice ID" value={data.voice_id ? data.voice_id.slice(0, 16) + "…" : "—"} />
        <Row label="LLM" value={data.llm_model} />
        <Row label="STT" value={data.stt_model} />
        <Row label="Temperature" value={data.llm_temperature.toFixed(1)} />
      </div>
    </div>
  );
}

// ── Success state ─────────────────────────────────────────────────────────────
function SuccessState({ agentName, agentId, onReset }: {
  agentName: string; agentId: number; onReset: () => void;
}) {
  const router = useRouter();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append("file", file);
    setUploadStatus("Uploading…");
    try {
      const res = await fetch(`http://localhost:8000/agents/${agentId}/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      setUploadStatus(`"${file.name}" indexed successfully`);
    } catch {
      setUploadStatus("Upload failed. Try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#4ade80]/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Agent Created</h2>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="text-foreground font-semibold">{agentName}</span> is ready to conduct interviews.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => router.push("/library")}
            className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors">
            View Agents
          </button>
          <button onClick={onReset}
            className="px-5 py-2.5 rounded-full border border-[#1a1a1a] text-[#d4d4d4] text-sm font-medium hover:border-[#2a2a2a] hover:text-white transition-colors">
            Create Another
          </button>
        </div>
      </div>

      <div className={sectionCls}>
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Knowledge Base <span className="text-muted-foreground/50 font-normal text-xs normal-case tracking-normal">(optional)</span></h3>
          <p className="text-sm text-muted-foreground mt-1">Upload a resume, job description, or reference docs so the agent can ask targeted questions.</p>
        </div>
        <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-[#1a1a1a] hover:border-[#4ade80]/40 hover:bg-[#4ade80]/5 transition-colors cursor-pointer">
          <div className="text-center space-y-1 pointer-events-none">
            <svg className="w-8 h-8 mx-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium">Click to upload</p>
            <p className="text-xs text-muted-foreground">PDF or TXT</p>
          </div>
          <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
        </label>
        {uploadStatus && (
          <p className={`text-sm ${uploadStatus.includes("successfully") ? "text-[#4ade80]" : "text-red-400"}`}>{uploadStatus}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const defaultForm: AgentFormData = {
  name: "", role: "", job_title: "", company_name: "",
  interview_type: "technical", difficulty: "mid",
  topics: [], max_questions: 10, system_instruction: "",
  language: "en", tts_model: "cartesia", voice_id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
  stt_model: "deepgram", llm_model: "llama-3.1-70b-versatile",
  llm_temperature: 0.7, vad_sensitivity: 0.5,
};

export default function CreateAgent() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<AgentFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const set = (k: keyof AgentFormData, v: unknown) => setData((prev) => ({ ...prev, [k]: v }));

  const canAdvance = () => {
    if (step === 0) return true;
    if (step === 1) return data.name.trim() !== "" && data.role.trim() !== "";
    if (step === 2) return data.voice_id.trim() !== "";
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setCreatedId(json.id);
    } catch {
      alert("Failed to create agent. Make sure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  if (createdId !== null) {
    return <SuccessState agentName={data.name} agentId={createdId} onReset={() => { setCreatedId(null); setStep(0); setData(defaultForm); }} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#4ade80] mb-3">
          Agent Builder
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Create Interview Agent</h1>
        <p className="text-muted-foreground mt-2 text-sm">Configure a voice AI agent to conduct interviews.</p>
      </div>

      <StepBar current={step} />

      <div className="min-h-[400px]">
        {step === 0 && <Step1 data={data} set={set} />}
        {step === 1 && <Step2 data={data} set={set} />}
        {step === 2 && <Step3 data={data} set={set} />}
        {step === 3 && <Step4 data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-[#1a1a1a] mt-6">
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0}
          className="px-5 py-2.5 rounded-full border border-[#1a1a1a] text-sm font-medium hover:bg-[#0f0f0f] hover:border-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          Back
        </button>

        <span className="text-xs text-muted-foreground">{step + 1} of {STEPS.length}</span>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}
            className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Continue
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-[#e5e5e5] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating…
              </>
            ) : "Create Agent"}
          </button>
        )}
      </div>
    </div>
  );
}
