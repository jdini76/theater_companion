"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISSED_VERSION_KEY = "theater_welcome_dismissed_version";

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-beta.1";

interface ReleaseNotes {
  version: string;
  date: string;
  highlights: string[];
}

// Newest first. Only the latest entry is shown in the "What's New" tab —
// older entries stay here for reference when writing the next one.
const RELEASE_NOTES: ReleaseNotes[] = [
  {
    version: "0.1.0-beta.1",
    date: "June 2026",
    highlights: [
      "Reworked how the Scene Viewer classifies dialogue, stage directions, and songs — including fixes for OCR-imported and screenplay-formatted scripts.",
      "Run Lines now correctly skips reclassified stage directions instead of reading them as a character's dialogue.",
      "Run Lines remembers the scenes you loaded, so navigating away and back no longer requires reloading them.",
      "Added character color selection and a more consistent layout for Voice Settings.",
      "Raised the size limit for PDF script imports, and Image (OCR) uploads now warn you up front when a large scanned PDF will take a while to process.",
      "Added anonymous usage analytics (PostHog) to understand which features are being used — no personal data is collected.",
    ],
  },
];

type Tab = "welcome" | "whats-new";

function readDismissedVersion(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("welcome");
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  // True once we know the user has previously checked "don't show again" —
  // they've already read the welcome blurb, so later update popups should
  // jump straight to What's New instead of repeating the intro.
  const [whatsNewOnly, setWhatsNewOnly] = useState(false);

  useEffect(() => {
    const dismissedVersion = readDismissedVersion();
    if (dismissedVersion === CURRENT_VERSION) return;
    setOpen(true);
    if (dismissedVersion !== null) {
      setWhatsNewOnly(true);
      setTab("whats-new");
    }
  }, []);

  if (!open) return null;

  const latest = RELEASE_NOTES[0];

  const handleClose = () => {
    if (neverShowAgain) {
      try {
        window.localStorage.setItem(DISMISSED_VERSION_KEY, CURRENT_VERSION);
      } catch {
        // Ignore storage errors — the modal will simply reappear next visit.
      }
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-base/80 backdrop-blur-sm px-4">
      <div className="card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <Image
            src="/TRM_Logo_favicon.png"
            alt=""
            width={40}
            height={40}
            className="rounded flex-shrink-0"
            unoptimized
          />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-light leading-snug">
              Welcome to Theater Rehearsal Manager
            </h2>
            <p className="text-xs text-muted font-mono mt-0.5">
              v{CURRENT_VERSION} · Beta
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="text-muted hover:text-light text-xl leading-none px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {(
            [
              { id: "welcome", label: "Welcome" },
              { id: "whats-new", label: "What's New" },
            ] as { id: Tab; label: string }[]
          )
            .filter((t) => !whatsNewOnly || t.id === "whats-new")
            .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
                tab === t.id
                  ? "text-accent-cyan border-b-2 border-accent-cyan bg-dark-panel"
                  : "text-muted hover:text-light"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm text-muted leading-relaxed">
          {tab === "welcome" ? (
            <div className="space-y-3">
              <p>
                Hello, and welcome — whether you&apos;re an actor, director, or
                anyone else who lives for the stage and screen, this page is
                built for you.
              </p>
              <p>
                <span className="text-light font-semibold">
                  Theater Rehearsal Manager
                </span>{" "}
                is a personal rehearsal companion. Import your script, assign a
                voice to every character besides your own, and let the app read
                those parts aloud — so you can run your lines in context,
                anytime, without needing a scene partner in the room.
              </p>
              <p>
                Organize everything by production, build out your cast, and
                practice scene by scene or run full set pieces back to back.
                Check the <span className="text-light font-semibold">About</span>{" "}
                page from the navigation any time for a full walkthrough.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-light font-semibold">
                  v{latest.version}{" "}
                  <span className="text-muted text-xs font-normal">
                    — {latest.date}
                  </span>
                </h3>
                <ul className="list-disc list-inside mt-2 space-y-1.5">
                  {latest.highlights.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-5 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={neverShowAgain}
              onChange={(e) => setNeverShowAgain(e.target.checked)}
              className="accent-accent-cyan w-4 h-4 mt-0.5 flex-shrink-0"
            />
            <span className="text-xs text-muted leading-snug">
              <span className="text-light font-medium">
                Don&apos;t show this again
              </span>
              <br />
              Heads up — while the app is in Beta, this popup will still appear
              after each new update so you don&apos;t miss important changes,
              even with this checked.
            </span>
          </label>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2.5 bg-accent-cyan text-dark-base font-bold rounded-lg hover:bg-accent-cyan/80 transition-colors"
          >
            Let&apos;s get started
          </button>
        </div>
      </div>
    </div>
  );
}
