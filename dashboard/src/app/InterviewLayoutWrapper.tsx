"use client";

import { usePathname } from "next/navigation";

export default function InterviewLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInterview = pathname.startsWith("/interview");

  if (isInterview) {
    // Full-screen, no padding, no wrapper
    return <div className="flex-1 min-w-0">{children}</div>;
  }

  return (
    <main className="flex-1 flex flex-col min-w-0">
      <div className="p-8">{children}</div>
    </main>
  );
}
