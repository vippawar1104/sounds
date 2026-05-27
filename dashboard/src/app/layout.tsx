import type { Metadata } from "next";
import "./globals.css";
import NavSidebar from "./NavSidebar";
import InterviewLayoutWrapper from "./InterviewLayoutWrapper";

export const metadata: Metadata = {
  title: "InterviewAI",
  description: "AI-powered voice interview platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#f5f5f5] flex min-h-screen">
        <NavSidebar />
        <InterviewLayoutWrapper>{children}</InterviewLayoutWrapper>
      </body>
    </html>
  );
}
