"use client";
import { useState } from "react";
import ScenesPage from "../scenes/page";
import CastPage from "../cast/page";
import RehearsalPage from "../rehearsals/page";
import { SettingsContent } from "@/components/settings/SettingsContent";

const TABS = [
  { id: "scenes", label: "Scenes" },
  { id: "cast", label: "Cast" },
  { id: "run-lines", label: "Run Lines" },
  { id: "settings", label: "Settings" },
];

export default function RehearsePage() {
  const [tab, setTab] = useState("scenes");

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex gap-2 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-light hover:text-accent-cyan"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === "scenes" && <ScenesPage />}
        {tab === "cast" && <CastPage />}
        {tab === "run-lines" && <RehearsalPage />}
        {tab === "settings" && <SettingsContent />}
      </div>
    </div>
  );
}
