import type { Metadata } from "next";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SceneProvider } from "@/contexts/SceneContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Theater Rehearsal Manager",
  description: "A comprehensive theater rehearsal management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ProjectProvider>
          <SceneProvider>{children}</SceneProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
