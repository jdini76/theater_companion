"use client";

import Link from "next/link";
import { useProjects } from "@/contexts/ProjectContext";
import { useScenes } from "@/contexts/SceneContext";
import { useVoice } from "@/contexts/VoiceContext";

// ─── Empty states ─────────────────────────────────────────────────────────────

function NoProductions() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-light">Dashboard</h1>
      <div className="card text-center py-16 space-y-6">
        <div className="text-6xl">🎭</div>
        <div>
          <h2 className="text-2xl font-bold text-light mb-2">Welcome</h2>
          <p className="text-muted">
            Create your first production to get started. Each production keeps
            its scenes, cast, and rehearsal settings separate.
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-block px-6 py-3 bg-accent-cyan text-dark-base font-bold rounded-lg hover:bg-accent-cyan/80 transition-colors"
        >
          + Create a Production
        </Link>
      </div>
    </main>
  );
}

function NoSelection({ count }: { count: number }) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-light">Dashboard</h1>
      <div className="card text-center py-16 space-y-6">
        <div className="text-6xl">🎭</div>
        <div>
          <h2 className="text-2xl font-bold text-light mb-2">Select a Production</h2>
          <p className="text-muted">
            You have {count} production{count !== 1 ? "s" : ""}. Choose one from the header dropdown or the list below.
          </p>
        </div>
        <Link
          href="/projects"
          className="inline-block px-6 py-3 bg-accent-cyan text-dark-base font-bold rounded-lg hover:bg-accent-cyan/80 transition-colors"
        >
          Go to Productions List
        </Link>
      </div>
    </main>
  );
}

// ─── Action tile ──────────────────────────────────────────────────────────────

function ActionTile({
  href,
  icon,
  label,
  description,
  primary,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl border p-5 transition-all ${
        primary
          ? "border-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20"
          : "border-border bg-dark-panel hover:border-accent-cyan hover:bg-dark-panel/80"
      }`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`font-bold text-sm mb-1 ${primary ? "text-accent-cyan" : "text-light"}`}>
        {label}
      </div>
      <div className="text-muted text-xs leading-snug">{description}</div>
    </Link>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Home() {
  const { projects, getCurrentProject, selectProject } = useProjects();
  const { getProjectScenes } = useScenes();
  const { getProjectCharacters } = useVoice();

  if (projects.length === 0) return <NoProductions />;

  const current = getCurrentProject();
  if (!current) return <NoSelection count={projects.length} />;

  const scenes = getProjectScenes(current.id);
  const characters = getProjectCharacters(current.id);
  const otherProductions = projects.filter((p) => p.id !== current.id);
  const createdDate = new Date(current.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* ── Page heading ── */}
      <div>
        <h1 className="text-3xl font-bold text-light">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          {current.name}
          {current.description ? ` — ${current.description}` : ""}
        </p>
        <p className="text-muted/50 text-xs mt-0.5">Created {createdDate}</p>
      </div>

      {/* ── Scenes & Cast expanded cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* Scenes card */}
        <div className="card flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-light">Scenes</h2>
            <span className="text-accent-cyan font-bold text-2xl">{scenes.length}</span>
          </div>

          {scenes.length === 0 ? (
            <p className="text-muted text-sm flex-1">
              No scenes imported yet.
            </p>
          ) : (
            <div className="space-y-1.5 flex-1">
              {scenes.slice(0, 6).map((scene, i) => {
                const lineCount = scene.content.split("\n").filter(Boolean).length;
                const charCount = scene.characters?.length ?? 0;
                return (
                  <div key={scene.id} className="flex items-center gap-3">
                    <span className="text-muted/50 text-xs font-mono w-4 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-light text-sm font-medium flex-1 truncate">
                      {scene.title}
                    </span>
                    <span className="text-muted text-xs flex-shrink-0">
                      {lineCount}L{charCount > 0 ? ` · ${charCount}C` : ""}
                    </span>
                  </div>
                );
              })}
              {scenes.length > 6 && (
                <p className="text-muted/60 text-xs pt-1">
                  +{scenes.length - 6} more
                </p>
              )}
            </div>
          )}

          <Link href="/rehearse" className="text-accent-cyan text-xs hover:underline mt-auto">
            {scenes.length === 0 ? "Import scenes →" : "Manage scenes →"}
          </Link>
        </div>

        {/* Cast card */}
        <div className="card flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-light">Cast</h2>
            <span className="text-accent-cyan font-bold text-2xl">{characters.length}</span>
          </div>

          {characters.length === 0 ? (
            <p className="text-muted text-sm flex-1">
              No characters detected yet. Import a scene to populate your cast.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 flex-1 content-start">
              {characters.slice(0, 12).map((c) => (
                <span
                  key={c.id}
                  className="px-2.5 py-1 bg-dark-input border border-border rounded-full text-xs text-light font-medium"
                >
                  {c.characterName}
                </span>
              ))}
              {characters.length > 12 && (
                <span className="px-2.5 py-1 text-xs text-muted/60">
                  +{characters.length - 12} more
                </span>
              )}
            </div>
          )}

          <Link href="/rehearse" className="text-accent-cyan text-xs hover:underline mt-auto">
            {characters.length === 0 ? "Set up cast →" : "Manage cast →"}
          </Link>
        </div>

      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-sm text-muted uppercase tracking-widest font-semibold mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ActionTile
            href="/rehearse"
            icon="▶"
            label="Rehearse"
            description="Run lines, manage scenes and cast"
            primary
          />
          <ActionTile
            href="/rehearse"
            icon="📄"
            label="Scenes"
            description="Import and manage your script"
          />
          <ActionTile
            href="/rehearse"
            icon="🎙️"
            label="Cast"
            description="Assign voices to characters"
          />
          <ActionTile
            href="/projects"
            icon="🎭"
            label="Productions"
            description="Manage all your productions"
          />
        </div>
      </div>

      {/* ── Switch production ── */}
      {otherProductions.length > 0 && (
        <div>
          <h2 className="text-sm text-muted uppercase tracking-widest font-semibold mb-4">
            Switch Production
          </h2>
          <div className="space-y-2">
            {otherProductions.map((p) => {
              const pScenes = getProjectScenes(p.id);
              const pChars = getProjectCharacters(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className="w-full flex items-center justify-between bg-dark-panel border border-border rounded-xl px-4 py-3 hover:border-accent-cyan transition-colors text-left group"
                >
                  <span className="text-light font-medium group-hover:text-accent-cyan transition-colors">
                    {p.name}
                  </span>
                  <span className="text-muted text-xs flex-shrink-0">
                    {pScenes.length} scene{pScenes.length !== 1 ? "s" : ""} · {pChars.length} character{pChars.length !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </main>
  );
}
