"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { getAudioCacheStats } from "@/lib/audio-cache";
import {
  exportAsZip,
  importFromZip,
  exportToFolder,
  importFromFolder,
  isFolderAccessSupported,
  exportToGoogleDrive,
  importFromGoogleDrive,
  exportToDropbox,
  importFromDropbox,
} from "@/lib/voice-cache-backup";

// ─── Types ────────────────────────────────────────────────────────────────────

type BackupTarget = "zip" | "folder" | "gdrive" | "dropbox";
type OpKind = "backup" | "restore";

type Phase =
  | { kind: "idle" }
  | {
      kind: "running";
      target: BackupTarget;
      op: OpKind;
      /** -1 = connecting / authenticating, ≥0 = file progress */
      done: number;
      total: number;
    }
  | {
      kind: "success";
      target: BackupTarget;
      op: OpKind;
      count: number;
      skipped?: number;
    }
  | { kind: "error"; target: BackupTarget; op: OpKind; message: string };

// ─── Card component ───────────────────────────────────────────────────────────

interface CardProps {
  id: BackupTarget;
  icon: string;
  label: string;
  description: string;
  available: boolean;
  unavailableNote: string;
  isRunning: boolean;
  activeTarget: BackupTarget | null;
  activeOp: OpKind | null;
  onBackup: () => void;
  onRestore: () => void;
}

function BackupCard({
  id,
  icon,
  label,
  description,
  available,
  unavailableNote,
  isRunning,
  activeTarget,
  activeOp,
  onBackup,
  onRestore,
}: CardProps) {
  const isActive = activeTarget === id;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-dark-panel flex flex-col">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <div>
          <div className="text-sm font-semibold text-light">{label}</div>
          <div className="text-xs text-muted mt-0.5">{description}</div>
        </div>
      </div>

      {!available ? (
        <p className="text-xs text-muted italic">{unavailableNote}</p>
      ) : (
        <div className="flex gap-2 flex-wrap mt-auto">
          <Button variant="secondary" onClick={onBackup} disabled={isRunning}>
            {isActive && activeOp === "backup" ? "Backing up…" : "Backup"}
          </Button>
          <Button variant="secondary" onClick={onRestore} disabled={isRunning}>
            {isActive && activeOp === "restore" ? "Restoring…" : "Restore"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────

const TARGET_LABELS: Record<BackupTarget, string> = {
  zip: "ZIP",
  folder: "folder",
  gdrive: "Google Drive",
  dropbox: "Dropbox",
};

function StatusBar({
  phase,
  onDismiss,
}: {
  phase: Phase;
  onDismiss: () => void;
}) {
  if (phase.kind === "idle") return null;

  if (phase.kind === "running") {
    const label = TARGET_LABELS[phase.target];
    const verb = phase.op === "backup" ? "Backing up to" : "Restoring from";
    const progress =
      phase.done < 0
        ? `Connecting to ${label}…`
        : phase.total > 0
          ? `${verb} ${label} — ${phase.done} / ${phase.total} files…`
          : `${verb} ${label}…`;
    return (
      <div className="rounded-lg bg-dark-panel border border-border px-4 py-3 text-sm text-muted">
        {progress}
      </div>
    );
  }

  if (phase.kind === "success") {
    const label = TARGET_LABELS[phase.target];
    const verb = phase.op === "backup" ? "backed up to" : "restored from";
    const skippedNote =
      phase.skipped && phase.skipped > 0 ? ` (${phase.skipped} skipped)` : "";
    return (
      <div className="rounded-lg bg-dark-panel border border-green-700 px-4 py-3 flex items-start justify-between gap-4">
        <p className="text-sm text-green-400">
          {phase.count} file{phase.count !== 1 ? "s" : ""} {verb} {label}
          {skippedNote}.
        </p>
        <button
          onClick={onDismiss}
          className="text-muted hover:text-light text-xs shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="rounded-lg bg-dark-panel border border-red-700 px-4 py-3 flex items-start justify-between gap-4">
        <p className="text-sm text-red-400">{phase.message}</p>
        <button
          onClick={onDismiss}
          className="text-muted hover:text-light text-xs shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function VoiceCacheBackupPanel() {
  const zipRestoreRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [stats, setStats] = useState<{
    count: number;
    totalSizeBytes: number;
  } | null>(null);
  const [folderSupported, setFolderSupported] = useState(false);

  useEffect(() => {
    getAudioCacheStats().then(setStats);
    setFolderSupported(isFolderAccessSupported());
  }, []);

  const isRunning = phase.kind === "running";
  const activeTarget = phase.kind === "running" ? phase.target : null;
  const activeOp = phase.kind === "running" ? phase.op : null;

  const run = async (
    target: BackupTarget,
    op: OpKind,
    fn: (onProgress: (done: number, total: number) => void) => Promise<{
      uploaded?: number;
      imported?: number;
      skipped?: number;
    } | void>,
  ) => {
    setPhase({ kind: "running", target, op, done: -1, total: 0 });
    const onProgress = (done: number, total: number) =>
      setPhase({ kind: "running", target, op, done, total });

    try {
      const raw = await fn(onProgress);
      const r = raw as Record<string, number> | null | undefined;
      const count = r ? (r.uploaded ?? r.imported ?? 0) : 0;
      const skipped = r?.skipped;
      setPhase({ kind: "success", target, op, count, skipped });
      if (op === "restore") getAudioCacheStats().then(setStats);
    } catch (err) {
      setPhase({
        kind: "error",
        target,
        op,
        message: err instanceof Error ? err.message : "Operation failed.",
      });
    }
  };

  // ZIP restore uses a hidden file input
  const handleZipRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (zipRestoreRef.current) zipRestoreRef.current.value = "";
    void run("zip", "restore", (onProgress) => importFromZip(file, onProgress));
  };

  const cards: CardProps[] = [
    {
      id: "zip",
      icon: "📦",
      label: "ZIP File",
      description:
        "Download a ZIP backup or restore from one. Works on all devices.",
      available: true,
      unavailableNote: "",
      isRunning,
      activeTarget,
      activeOp,
      onBackup: () =>
        void run("zip", "backup", (onProgress) => exportAsZip(onProgress)),
      onRestore: () => zipRestoreRef.current?.click(),
    },
    {
      id: "folder",
      icon: "📂",
      label: "Save to Folder",
      description:
        "Pick any folder on your device. On Mac, iPad & iPhone the picker shows iCloud Drive.",
      available: folderSupported,
      unavailableNote:
        "Not supported in this browser. Use ZIP or switch to Chrome / Edge / Safari.",
      isRunning,
      activeTarget,
      activeOp,
      onBackup: () =>
        void run("folder", "backup", (onProgress) =>
          exportToFolder(onProgress),
        ),
      onRestore: () =>
        void run("folder", "restore", (onProgress) =>
          importFromFolder(onProgress),
        ),
    },
    {
      id: "gdrive",
      icon: "🔵",
      label: "Google Drive",
      description:
        'Signs you in with Google and saves to a "Theater Voice Cache" folder in your Drive.',
      available: false,
      unavailableNote: "Coming soon.",
      isRunning,
      activeTarget,
      activeOp,
      onBackup: () =>
        void run("gdrive", "backup", (onProgress) =>
          exportToGoogleDrive(onProgress),
        ),
      onRestore: () =>
        void run("gdrive", "restore", (onProgress) =>
          importFromGoogleDrive(onProgress),
        ),
    },
    {
      id: "dropbox",
      icon: "🔷",
      label: "Dropbox",
      description:
        'Signs you in with Dropbox and saves to "Theater Voice Cache" in your Dropbox.',
      available: false,
      unavailableNote: "Coming soon.",
      isRunning,
      activeTarget,
      activeOp,
      onBackup: () =>
        void run("dropbox", "backup", (onProgress) =>
          exportToDropbox(onProgress),
        ),
      onRestore: () =>
        void run("dropbox", "restore", (onProgress) =>
          importFromDropbox(onProgress),
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats === null ? (
        <p className="text-muted text-sm">Loading cache info…</p>
      ) : stats.count === 0 ? (
        <p className="text-muted text-sm">
          No cached audio files yet. Voice lines are cached as you rehearse.
        </p>
      ) : (
        <p className="text-muted text-sm">
          {stats.count} audio file{stats.count !== 1 ? "s" : ""} cached —{" "}
          {(stats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}

      {/* Destination cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <BackupCard key={card.id} {...card} />
        ))}
      </div>

      {/* Status / progress */}
      <StatusBar phase={phase} onDismiss={() => setPhase({ kind: "idle" })} />

      {/* Hidden file input for ZIP restore */}
      <input
        ref={zipRestoreRef}
        type="file"
        accept=".zip"
        onChange={handleZipRestoreFile}
        className="hidden"
      />
    </div>
  );
}
