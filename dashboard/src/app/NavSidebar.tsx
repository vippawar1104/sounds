"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  Compass,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: Compass },
  { href: "/library", label: "Agents", icon: Bot },
  { href: "/create-agent", label: "Create", icon: Plus },
];

const quickFacts = [
  { label: "Runtime", value: "LiveKit room worker" },
  { label: "LLM", value: "Claude Haiku" },
  { label: "Voice", value: "ElevenLabs" },
];

function NavIcon({ icon: Icon, active }: { icon: typeof Compass; active: boolean }) {
  return <Icon size={15} strokeWidth={active ? 2.2 : 1.9} className={active ? "text-[#57d18c]" : "text-[#8ea0b2]"} />;
}

export default function NavSidebar() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview")) return null;

  return (
    <aside className="sticky top-0 flex h-screen w-[292px] flex-col border-r border-white/10 bg-[#060a0f] px-4 py-5">
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#57d18c] text-[#06110b] shadow-[0_12px_30px_rgba(87,209,140,0.22)]">
              <Sparkles size={18} strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-[#eef2f5]">Sounds</p>
              <p className="text-[12px] text-[#8ea0b2]">Interview control plane</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Live
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {quickFacts.map((item) => (
            <div key={item.label} className="surface rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#8090a0]">{item.label}</div>
              <div className="mt-1 text-sm font-medium text-[#eef2f5]">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium ${
                isActive
                  ? "bg-white/8 text-white ring-1 ring-white/10"
                  : "text-[#93a0af] hover:bg-white/4 hover:text-white"
              }`}
            >
              <NavIcon icon={icon} active={isActive} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8090a0]">
          <ShieldCheck size={14} />
          Operational Notes
        </div>
        <p className="mt-2 text-sm leading-6 text-[#d8dee5]">
          Keep keys server-side, dispatch one worker per room, and persist transcript events as they arrive.
        </p>
        <Link href="/create-agent" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#57d18c]">
          Create an agent <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-[#8ea0b2]">
        <Settings2 size={14} />
        Settings will land in a later pass.
      </div>
    </aside>
  );
}
