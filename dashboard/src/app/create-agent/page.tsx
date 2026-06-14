"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Mic,
  PencilLine,
  Rocket,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import {
  AgentDraft,
  agentTypeMeta,
  buildInterviewPrompt,
  defaultAgentDraft,
  difficultyMeta,
  fetchJson,
  fmtSeconds,
  topicPresets,
  voicePresets,
} from "@/lib/interview-platform";

const sectionClass = "surface rounded-[26px] p-6";
const inputClass =
  "mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#eef2f5] placeholder:text-[#8190a1] focus:border-[#57d18c]/60";
const labelClass = "block text-sm font-medium text-[#dfe6eb]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-3">
        <span className={labelClass}>{label}</span>
        {hint ? <span className="text-[12px] text-[#8190a1]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function TagButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-[12px] font-medium ${
        active
          ? "border-[#57d18c]/50 bg-[#57d18c]/12 text-[#9af0bf]"
          : "border-white/10 bg-white/4 text-[#b8c3ce] hover:bg-white/6 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-white/8 py-3 first:border-t-0 first:pt-0">
      <span className="text-[12px] uppercase tracking-[0.16em] text-[#8190a1]">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-[#eef2f5]">{value}</span>
    </div>
  );
}

function SuccessState({
  agentName,
  agentId,
  onReset,
}: {
  agentName: string;
  agentId: number;
  onReset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="glass-panel rounded-[28px] p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#57d18c]/12 text-[#57d18c]">
          <CheckCircle2 size={32} strokeWidth={2.2} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-[#f6f8fb]">Agent saved</h1>
        <p className="mt-3 text-base leading-7 text-[#8ea0b2]">
          <span className="font-medium text-[#eef2f5]">{agentName}</span> is ready to run interviews. You can
          launch a session from the library or create another interviewer.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => router.push("/library")}
            className="inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b]"
          >
            Open library
            <ArrowRight size={16} />
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#eef2f5]"
          >
            Create another
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={sectionClass}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
            <FileText size={14} />
            Next step
          </div>
          <p className="mt-3 text-sm leading-7 text-[#d8dee5]">
            Connect this agent to a session flow, then keep transcript events and evaluation output in the same record.
          </p>
        </div>
        <div className={sectionClass}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
            <Sparkles size={14} />
            Saved reference
          </div>
          <div className="mt-4 space-y-2 text-sm text-[#d8dee5]">
            <div className="flex items-center justify-between">
              <span className="text-[#8190a1]">Agent ID</span>
              <span className="font-medium text-[#eef2f5]">#{agentId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8190a1]">Status</span>
              <span className="rounded-full bg-[#57d18c]/12 px-2.5 py-1 text-[11px] font-semibold text-[#57d18c]">
                Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateAgent() {
  const router = useRouter();
  const [data, setData] = useState<AgentDraft>(defaultAgentDraft);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const promptPreview = useMemo(() => buildInterviewPrompt(data), [data]);
  const selectedType = agentTypeMeta[data.interview_type];
  const selectedDifficulty = difficultyMeta[data.difficulty];
  const voice = voicePresets.find((item) => item.id === data.voice_id) ?? voicePresets[0];

  const patch = <K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        system_instruction: promptPreview,
      };
      const json = await fetchJson<{ id: number }>("/agents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedId(json.id);
    } catch {
      window.alert("Could not save the agent. Make sure the backend is running on port 8000.");
    } finally {
      setSaving(false);
    }
  };

  if (createdId !== null) {
    return (
      <SuccessState
        agentName={data.name || "New agent"}
        agentId={createdId}
        onReset={() => {
          setCreatedId(null);
          setData(defaultAgentDraft);
        }}
      />
    );
  }

  const canSave = data.name.trim().length > 0 && data.role.trim().length > 0;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
      <section className="glass-panel rounded-[28px] p-7 lg:p-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ea0b2]">
            <Rocket size={13} />
            Agent builder
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#57d18c]/20 bg-[#57d18c]/12 px-3 py-1 text-[11px] font-semibold text-[#9af0bf]">
            <WandSparkles size={13} />
            Claude Haiku + ElevenLabs
          </span>
        </div>
        <div className="mt-5 max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-[#f6f8fb] lg:text-5xl">
            Build an interviewer with the right tone, role, and evaluation shape.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#8ea0b2]">
            Tune the interview context on the left and review the generated prompt on the right before saving.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className={sectionClass}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <PencilLine size={14} />
              Interview context
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Agent name" hint="Required">
                <input
                  className={inputClass}
                  value={data.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="Avery"
                />
              </Field>
              <Field label="Agent role" hint="Required">
                <input
                  className={inputClass}
                  value={data.role}
                  onChange={(e) => patch("role", e.target.value)}
                  placeholder="Senior Backend Interviewer"
                />
              </Field>
              <Field label="Job title">
                <input
                  className={inputClass}
                  value={data.job_title}
                  onChange={(e) => patch("job_title", e.target.value)}
                  placeholder="Backend Engineer"
                />
              </Field>
              <Field label="Company">
                <input
                  className={inputClass}
                  value={data.company_name}
                  onChange={(e) => patch("company_name", e.target.value)}
                  placeholder="Northstar"
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Interview type">
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["technical", "behavioral", "screening"] as const).map((type) => (
                    <TagButton
                      key={type}
                      active={data.interview_type === type}
                      label={agentTypeMeta[type].label}
                      onClick={() => patch("interview_type", type)}
                    />
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Difficulty">
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["junior", "mid", "senior"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => patch("difficulty", level)}
                      className={`rounded-2xl border px-3 py-3 text-left ${
                        data.difficulty === level
                          ? "border-[#57d18c]/50 bg-[#57d18c]/12 text-[#9af0bf]"
                          : "border-white/10 bg-white/4 text-[#b8c3ce] hover:bg-white/6"
                      }`}
                    >
                      <div className="text-sm font-semibold">{difficultyMeta[level].label}</div>
                      <div className="mt-1 text-[12px] text-[#8ea0b2]">{difficultyMeta[level].detail}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Max questions" hint={`${data.max_questions} questions`}>
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  className="mt-4 w-full accent-[#57d18c]"
                  value={data.max_questions}
                  onChange={(e) => patch("max_questions", Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Topics">
                <div className="mt-2 flex flex-wrap gap-2">
                  {topicPresets[data.interview_type].map((topic) => {
                    const active = data.topics.includes(topic);
                    return (
                      <TagButton
                        key={topic}
                        active={active}
                        label={topic}
                        onClick={() =>
                          patch(
                            "topics",
                            active ? data.topics.filter((item) => item !== topic) : [...data.topics, topic],
                          )
                        }
                      />
                    );
                  })}
                </div>
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <Mic size={14} />
              Voice and model settings
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Language">
                <select className={inputClass} value={data.language} onChange={(e) => patch("language", e.target.value)}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="hi">Hindi</option>
                </select>
              </Field>

              <Field label="Voice">
                <select className={inputClass} value={data.voice_id} onChange={(e) => patch("voice_id", e.target.value)}>
                  {voicePresets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {item.style}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="STT provider">
                <select className={inputClass} value={data.stt_model} onChange={(e) => patch("stt_model", e.target.value as AgentDraft["stt_model"])}>
                  <option value="elevenlabs">ElevenLabs Scribe</option>
                </select>
              </Field>

              <Field label="LLM model">
                <select className={inputClass} value={data.llm_model} onChange={(e) => patch("llm_model", e.target.value as AgentDraft["llm_model"])}>
                  <option value="claude-haiku">Claude Haiku</option>
                </select>
              </Field>

              <Field label="TTS provider">
                <select className={inputClass} value={data.tts_model} onChange={(e) => patch("tts_model", e.target.value as AgentDraft["tts_model"])}>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>

              <Field label="Tone">
                <select className={inputClass} value={data.tone} onChange={(e) => patch("tone", e.target.value as AgentDraft["tone"])}>
                  <option value="warm">Warm</option>
                  <option value="balanced">Balanced</option>
                  <option value="rigorous">Rigorous</option>
                </select>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="LLM temperature" hint={data.llm_temperature.toFixed(1)}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  className="mt-4 w-full accent-[#57d18c]"
                  value={data.llm_temperature}
                  onChange={(e) => patch("llm_temperature", Number(e.target.value))}
                />
              </Field>

              <Field label="VAD sensitivity" hint={data.vad_sensitivity.toFixed(1)}>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  className="mt-4 w-full accent-[#57d18c]"
                  value={data.vad_sensitivity}
                  onChange={(e) => patch("vad_sensitivity", Number(e.target.value))}
                />
              </Field>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <FileText size={14} />
              Prompt override
            </div>
            <textarea
              rows={7}
              className={`${inputClass} mt-4 resize-none`}
              value={data.system_instruction}
              onChange={(e) => patch("system_instruction", e.target.value)}
              placeholder="Leave empty to use the generated prompt."
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => router.push("/library")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#eef2f5]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSave || saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#57d18c] px-5 py-3 text-sm font-semibold text-[#06110b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save agent"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className="glass-panel rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#8190a1]">Live preview</p>
                <h2 className="mt-2 text-xl font-semibold text-[#f6f8fb]">{data.name || "Untitled interviewer"}</h2>
              </div>
              <div
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: selectedType.soft, color: selectedType.accent }}
              >
                {selectedType.label}
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/4 p-4">
              <PreviewLine label="Role" value={data.role || "Interviewing agent"} />
              <PreviewLine label="Target" value={data.job_title || "Role not set"} />
              <PreviewLine label="Company" value={data.company_name || "Company not set"} />
              <PreviewLine label="Difficulty" value={selectedDifficulty.label} />
              <PreviewLine label="Tone" value={data.tone} />
              <PreviewLine label="Voice" value={voice.name} />
              <PreviewLine label="Questions" value={`${data.max_questions} max`} />
            </div>
          </section>

          <section className="glass-panel rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <WandSparkles size={14} />
              Generated prompt
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#d8dee5]">{promptPreview}</p>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8190a1]">
              <Sparkles size={14} />
              Runtime shape
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-3">
                <span className="text-sm text-[#b8c3ce]">TTS voice</span>
                <span className="text-sm font-medium text-[#eef2f5]">{voice.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-3">
                <span className="text-sm text-[#b8c3ce]">Estimated duration</span>
                <span className="text-sm font-medium text-[#eef2f5]">{fmtSeconds(data.max_questions * 95)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-3">
                <span className="text-sm text-[#b8c3ce]">STT / LLM</span>
                <span className="text-sm font-medium text-[#eef2f5]">
                  {data.stt_model} / {data.llm_model}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
