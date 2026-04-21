"use client";
import { useState } from "react";
import Link from "next/link";

const TABS = [
  { id: "scenes", label: "Scenes" },
  { id: "cast", label: "Cast" },
  { id: "run-lines", label: "Run Lines" },
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
        {tab === "scenes" && <ScenesTab />}
        {tab === "cast" && <CastTab />}
        {tab === "run-lines" && <RunLinesTab />}
      </div>
    </div>
  );
}

function ScenesTab() {
  // Lazy-load the actual scenes page
  const ScenesPage = require("../scenes/page").default;
  return <ScenesPage />;
}

function CastTab() {
  const CastPage = require("../cast/page").default;
  return <CastPage />;
}

function RunLinesTab() {
  const RehearsalPage = require("../rehearsals/page").default;
  return <RehearsalPage />;
}
