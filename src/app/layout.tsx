import type { Metadata } from "next";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { RehearsalProvider } from "@/contexts/RehearsalContext";
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
          <SceneProvider>
            <VoiceProvider>
              <RehearsalProvider>{children}</RehearsalProvider>
            </VoiceProvider>
          </SceneProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
