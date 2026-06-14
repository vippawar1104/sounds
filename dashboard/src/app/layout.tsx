import type { Metadata } from "next";
import "./globals.css";
import NavSidebar from "./NavSidebar";
import InterviewLayoutWrapper from "./InterviewLayoutWrapper";

export const metadata: Metadata = {
  title: "Sounds Interview Platform",
  description: "Configure AI interviewers, launch LiveKit sessions, and review transcripts and evaluations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-[#070b10] text-[#ecf0f3] antialiased">
        <NavSidebar />
        <InterviewLayoutWrapper>{children}</InterviewLayoutWrapper>
      </body>
    </html>
  );
}
