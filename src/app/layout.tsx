import type { Metadata } from "next";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { RehearsalProvider } from "@/contexts/RehearsalContext";
import { WelcomeModal } from "@/components/common/WelcomeModal";
import "./globals.css";

export const metadata: Metadata = {
  title: "Theater Rehearsal Manager",
  description: "A comprehensive theater rehearsal management platform",
  icons: {
    icon: "/TRM_Logo_favicon.png",
    apple: "/TRM_Logo_favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Apply saved theme before React hydrates to avoid a flash of dark mode */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('theater_theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
        }}
      />
      <body className="antialiased">
        <ProjectProvider>
          <SceneProvider>
            <VoiceProvider>
              <RehearsalProvider>
                <WelcomeModal />
                {children}
              </RehearsalProvider>
            </VoiceProvider>
          </SceneProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
