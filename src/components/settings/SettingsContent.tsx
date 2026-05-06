"use client";

import React, { useState, useEffect, useRef } from "react";
import { getAvailableVoices } from "@/lib/voice";
import { Button } from "@/components/ui/Button";
import { TTSSettings } from "@/types/voice";
import {
  speakTextViaApi,
  stopApiAudio,
  buildTTSPayload,
  fetchApiVoices,
  ApiVoice,
} from "@/lib/voice";
import {
  KOKORO_VOICES,
  loadKokoro,
  stopKokoroAudio,
  speakTextViaKokoro,
  getKokoroLoadState,
  getKokoroLoadedDevice,
  onKokoroStateChange,
  resetKokoro,
  isWebGPUSupported,
  KokoroLoadState,
} from "@/lib/kokoro-tts";
import {
  getAllStoredProjects,
  exportSelectedProjects,
  parseImportFile,
  executeImport,
  restoreLegacyBackup,
  getStorageSummary,
  type ImportedProject,
} from "@/lib/data-export";
import { useDeviceCapabilities } from "@/hooks/useDeviceCapabilities";

// ─── Known voices catalogue ────────────────────────────────────────────────
// Names sourced from actual iOS speechSynthesis.getVoices() output.
// Enhanced/Premium variants kept for future-proofing; show dimmed if absent.
const KNOWN_VOICE_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "bn", label: "Bengali" },
  { code: "ca", label: "Catalan" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "es", label: "Spanish" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "kn", label: "Kannada" },
  { code: "ko", label: "Korean" },
  { code: "ms", label: "Malay" },
  { code: "nb", label: "Norwegian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "yue", label: "Cantonese" },
  { code: "zh", label: "Chinese" },
];

interface KnownVoice {
  name: string;
  lang: string;
}
const KNOWN_VOICES: KnownVoice[] = [
  // ── iOS English ───────────────────────────────────────────────────────
  // Note: iOS Web Speech API returns only the base name regardless of whether
  // the standard, Enhanced, or Premium version is downloaded. The downloaded
  // quality tier is used automatically when the voice speaks.
  { name: "Albert", lang: "en-US" },
  { name: "Bad News", lang: "en-US" },
  { name: "Bahh", lang: "en-US" },
  { name: "Bells", lang: "en-US" },
  { name: "Boing", lang: "en-US" },
  { name: "Bubbles", lang: "en-US" },
  { name: "Cellos", lang: "en-US" },
  { name: "Fred", lang: "en-US" },
  { name: "Good News", lang: "en-US" },
  { name: "Jester", lang: "en-US" },
  { name: "Junior", lang: "en-US" },
  { name: "Kathy", lang: "en-US" },
  { name: "Organ", lang: "en-US" },
  { name: "Ralph", lang: "en-US" },
  { name: "Samantha", lang: "en-US" },
  { name: "Superstar", lang: "en-US" },
  { name: "Trinoids", lang: "en-US" },
  { name: "Whisper", lang: "en-US" },
  { name: "Wobble", lang: "en-US" },
  { name: "Zarvox", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Karen", lang: "en-AU" },
  { name: "Moira", lang: "en-IE" },
  { name: "Rishi", lang: "en-IN" },
  { name: "Tessa", lang: "en-ZA" },
  // ── Chrome / Desktop – English ────────────────────────────────────────
  { name: "Google US English", lang: "en-US" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
  // ── Windows SAPI ──────────────────────────────────────────────────────
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  { name: "Microsoft Mark - English (United States)", lang: "en-US" },
  // ── Arabic ───────────────────────────────────────────────────────────
  { name: "Majed", lang: "ar-001" },
  // ── Bulgarian ────────────────────────────────────────────────────────
  { name: "Daria", lang: "bg-BG" },
  // ── Bengali ──────────────────────────────────────────────────────────
  { name: "Piya", lang: "bn-IN" },
  // ── Catalan ──────────────────────────────────────────────────────────
  { name: "Montse", lang: "ca-ES" },
  // ── Czech ────────────────────────────────────────────────────────────
  { name: "Zuzana", lang: "cs-CZ" },
  // ── Danish ───────────────────────────────────────────────────────────
  { name: "Sara", lang: "da-DK" },
  // ── German ───────────────────────────────────────────────────────────
  { name: "Anna", lang: "de-DE" },
  // ── Greek ────────────────────────────────────────────────────────────
  { name: "Melina", lang: "el-GR" },
  // ── Spanish ──────────────────────────────────────────────────────────
  { name: "Mónica", lang: "es-ES" },
  { name: "Paulina", lang: "es-MX" },
  // ── Finnish ──────────────────────────────────────────────────────────
  { name: "Satu", lang: "fi-FI" },
  // ── French ───────────────────────────────────────────────────────────
  { name: "Amélie", lang: "fr-CA" },
  { name: "Thomas", lang: "fr-FR" },
  // ── Hebrew ───────────────────────────────────────────────────────────
  { name: "Carmit", lang: "he-IL" },
  // ── Hindi ────────────────────────────────────────────────────────────
  { name: "Lekha", lang: "hi-IN" },
  // ── Croatian ─────────────────────────────────────────────────────────
  { name: "Lana", lang: "hr-HR" },
  // ── Hungarian ────────────────────────────────────────────────────────
  { name: "Tünde", lang: "hu-HU" },
  // ── Indonesian ───────────────────────────────────────────────────────
  { name: "Damayanti", lang: "id-ID" },
  // ── Italian ──────────────────────────────────────────────────────────
  { name: "Alice", lang: "it-IT" },
  // ── Japanese ─────────────────────────────────────────────────────────
  { name: "Kyoko", lang: "ja-JP" },
  // ── Kannada ──────────────────────────────────────────────────────────
  { name: "Soumya", lang: "kn-IN" },
  // ── Korean ───────────────────────────────────────────────────────────
  { name: "Yuna", lang: "ko-KR" },
  // ── Malay ────────────────────────────────────────────────────────────
  { name: "Amira", lang: "ms-MY" },
  // ── Norwegian ────────────────────────────────────────────────────────
  { name: "Nora", lang: "nb-NO" },
  // ── Dutch ────────────────────────────────────────────────────────────
  { name: "Ellen", lang: "nl-BE" },
  { name: "Xander", lang: "nl-NL" },
  // ── Polish ───────────────────────────────────────────────────────────
  { name: "Zosia", lang: "pl-PL" },
  // ── Portuguese ───────────────────────────────────────────────────────
  { name: "Joana", lang: "pt-PT" },
  { name: "Luciana", lang: "pt-BR" },
  // ── Romanian ─────────────────────────────────────────────────────────
  { name: "Ioana", lang: "ro-RO" },
  // ── Russian ──────────────────────────────────────────────────────────
  { name: "Milena", lang: "ru-RU" },
  // ── Slovak ───────────────────────────────────────────────────────────
  { name: "Laura", lang: "sk-SK" },
  // ── Slovenian ────────────────────────────────────────────────────────
  { name: "Tina", lang: "sl-SI" },
  // ── Swedish ──────────────────────────────────────────────────────────
  { name: "Alva", lang: "sv-SE" },
  // ── Tamil ────────────────────────────────────────────────────────────
  { name: "Vani", lang: "ta-IN" },
  // ── Telugu ───────────────────────────────────────────────────────────
  { name: "Geeta", lang: "te-IN" },
  // ── Thai ─────────────────────────────────────────────────────────────
  { name: "Kanya", lang: "th-TH" },
  // ── Turkish ──────────────────────────────────────────────────────────
  { name: "Yelda", lang: "tr-TR" },
  // ── Ukrainian ────────────────────────────────────────────────────────
  { name: "Lesya", lang: "uk-UA" },
  // ── Vietnamese ───────────────────────────────────────────────────────
  { name: "Linh", lang: "vi-VN" },
  // ── Cantonese ────────────────────────────────────────────────────────
  { name: "Sinji", lang: "yue-HK" },
  // ── Chinese ──────────────────────────────────────────────────────────
  { name: "Meijia", lang: "zh-TW" },
  { name: "Tingting", lang: "zh-CN" },
];
// ──────────────────────────────────────────────────────────────────────────

const TTS_SETTINGS_KEY = "theater_tts_settings";

const DEFAULT_TTS_SETTINGS: TTSSettings = {
  provider: "browser",
  apiUrl: "",
  apiPath: "/v1/audio/speech",
  apiKey: "",
  defaultVoiceId: "",
  responseFormat: "mp3",
  stream: true,
  extraPayload: {},
  previewText: "Hello, this is a voice test.",
  kokoroVoice: "am_puck",
  kokoroSpeed: 1,
  kokoroDevice: "wasm",
  kokoroPreGenEnabled: true,
  enableAudioCache: false,
};

function loadTTSSettings(): TTSSettings {
  if (typeof window === "undefined") return DEFAULT_TTS_SETTINGS;
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_TTS_SETTINGS;
}

function saveTTSSettings(settings: TTSSettings): void {
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
}

type PanelPhase =
  | { kind: "idle" }
  | {
      kind: "resolving";
      projects: ImportedProject[];
      names: Map<string, string>;
      selected: Set<string>;
    }
  | { kind: "done"; count: number };

function DataManagementPanel() {
  const importFileRef = useRef<HTMLInputElement>(null);
  const legacyFileRef = useRef<HTMLInputElement>(null);

  const [summary, setSummary] = useState<{
    projectCount: number;
    sceneCount: number;
    characterCount: number;
    totalSizeKB: number;
  } | null>(null);
  const [allProjects, setAllProjects] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<PanelPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [legacyStatus, setLegacyStatus] = useState<string | null>(null);

  useEffect(() => {
    getStorageSummary().then(setSummary);
    const projects = getAllStoredProjects() as { id: string; name: string }[];
    setAllProjects(projects);
    setSelectedIds(new Set(projects.map((p) => p.id)));
  }, []);

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === allProjects.length
        ? new Set()
        : new Set(allProjects.map((p) => p.id)),
    );
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;
    await exportSelectedProjects(Array.from(selectedIds));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importFileRef.current) importFileRef.current.value = "";
    setError(null);
    try {
      const projects = await parseImportFile(file);
      const names = new Map(
        projects.map((p) => [p.bundle.project.id as string, p.name]),
      );
      // If you want to save settings here, do so as a side effect
      // saveTTSSettings({ ...settings, previewText: testText, voiceLangs });
      const selected = new Set(
        projects.map((p) => p.bundle.project.id as string),
      );
      setPhase({ kind: "resolving", projects, names, selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    }
  };

  const handleConfirmImport = async () => {
    if (phase.kind !== "resolving") return;
    const resolved = phase.projects
      .filter((p) => phase.selected.has(p.bundle.project.id as string))
      .map((p) => ({
        ...p,
        name: phase.names.get(p.bundle.project.id as string) ?? p.name,
      }));
    const count = await executeImport(resolved);
    setPhase({ kind: "done", count });
  };

  const handleLegacyRestore = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (legacyFileRef.current) legacyFileRef.current.value = "";
    setLegacyStatus(null);
    try {
      const result = await restoreLegacyBackup(file);
      setLegacyStatus(
        `Restored ${result.keysRestored} items from ${result.exportedAt.slice(0, 10)}. Reload the page to see changes.`,
      );
      setSummary(await getStorageSummary());
    } catch (err) {
      setLegacyStatus(err instanceof Error ? err.message : "Restore failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Projects", value: summary.projectCount },
            { label: "Scenes", value: summary.sceneCount },
            { label: "Characters", value: summary.characterCount },
            { label: "Size", value: `${summary.totalSizeKB} KB` },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-dark-panel rounded p-3 text-center"
            >
              <div className="text-2xl font-bold text-light">{item.value}</div>
              <div className="text-muted text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Export ── */}
      <div className="space-y-3">
        <h3 className="text-light font-semibold">Export Projects</h3>
        {allProjects.length === 0 ? (
          <p className="text-muted text-sm">No projects to export.</p>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-hidden">
              <label className="flex items-center gap-3 px-3 py-2 bg-dark-panel cursor-pointer border-b border-border hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === allProjects.length &&
                    allProjects.length > 0
                  }
                  onChange={toggleAll}
                  className="accent-accent-cyan"
                />
                <span className="text-xs font-semibold text-muted uppercase tracking-widest">
                  All Projects
                </span>
                <span className="ml-auto text-xs text-muted">
                  {selectedIds.size} / {allProjects.length}
                </span>
              </label>
              {allProjects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors border-b border-border last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="accent-accent-cyan"
                  />
                  <span className="text-sm text-light">{project.name}</span>
                </label>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={selectedIds.size === 0}
            >
              Export {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Project
              {selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </>
        )}
      </div>

      {/* ── Import ── */}
      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-light font-semibold">Import Projects</h3>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {phase.kind === "idle" && (
          <>
            <p className="text-muted text-sm">
              Importing will never overwrite existing projects. If a name
              conflicts you can rename it before importing.
            </p>
            <Button
              variant="secondary"
              onClick={() => importFileRef.current?.click()}
            >
              Choose File to Import
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </>
        )}

        {phase.kind === "resolving" && (
          <div className="space-y-4">
            <p className="text-muted text-sm">
              Review the projects below. Rename any that conflict with an
              existing project name.
            </p>
            <div className="space-y-2">
              {phase.projects.map((p) => {
                const id = p.bundle.project.id as string;
                const currentName = phase.names.get(id) ?? p.name;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-lg border bg-background/50 transition-opacity ${phase.selected.has(id) ? "border-border" : "border-border opacity-40"}`}
                  >
                    <input
                      type="checkbox"
                      checked={phase.selected.has(id)}
                      onChange={() => {
                        const next = new Set(phase.selected);
                        next.has(id) ? next.delete(id) : next.add(id);
                        setPhase({ ...phase, selected: next });
                      }}
                      className="accent-accent-cyan flex-shrink-0"
                    />
                    {p.hasConflict ? (
                      <span className="text-xs text-yellow-400 font-semibold w-16 flex-shrink-0">
                        Conflict
                      </span>
                    ) : (
                      <span className="text-xs text-green-400 font-semibold w-16 flex-shrink-0">
                        Ready
                      </span>
                    )}
                    <input
                      type="text"
                      value={currentName}
                      onChange={(e) => {
                        const next = new Map(phase.names);
                        next.set(id, e.target.value);
                        setPhase({ ...phase, names: next });
                      }}
                      className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-light focus:outline-none focus:border-accent-cyan"
                    />
                    <span className="text-xs text-muted flex-shrink-0">
                      {(p.bundle.scenes as unknown[]).length} scene
                      {(p.bundle.scenes as unknown[]).length !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={phase.selected.size === 0}
              >
                Import {phase.selected.size} Project
                {phase.selected.size !== 1 ? "s" : ""}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPhase({ kind: "idle" });
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {phase.kind === "done" && (
          <div className="space-y-3">
            <p className="text-green-400 text-sm">
              Imported {phase.count} project{phase.count !== 1 ? "s" : ""}{" "}
              successfully.
            </p>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Reload to See Projects
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPhase({ kind: "idle" })}
              >
                Import More
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Legacy restore ── */}
      <div className="border-t border-border pt-4 space-y-2">
        <p className="text-muted text-xs">
          Have an older full backup (v1)?{" "}
          <button
            onClick={() => legacyFileRef.current?.click()}
            className="text-accent-cyan hover:underline"
          >
            Restore legacy backup
          </button>
        </p>
        <input
          ref={legacyFileRef}
          type="file"
          accept=".json"
          onChange={handleLegacyRestore}
          className="hidden"
        />
        {legacyStatus && <p className="text-xs text-muted">{legacyStatus}</p>}
      </div>
    </div>
  );
}

type SettingsTab = "voice" | "data";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "voice", label: "Voice Settings" },
  { id: "data", label: "Data Management" },
];

export function SettingsContent() {
  const { canUseKokoro, deviceType } = useDeviceCapabilities();
  const isIOSDevice = deviceType === "ios";
  const [activeTab, setActiveTab] = useState<SettingsTab>("voice");
  const [settings, setSettings] = useState<TTSSettings>(DEFAULT_TTS_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [extraPayloadJson, setExtraPayloadJson] = useState("{}");
  const [extraPayloadError, setExtraPayloadError] = useState<string | null>(
    null,
  );
  const [testText, setTestText] = useState("Hello, this is a voice test.");
  const [testPlaying, setTestPlaying] = useState(false);
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [kokoroLoadState, setKokoroLoadState] = useState<KokoroLoadState>(() =>
    typeof window !== "undefined" ? getKokoroLoadState() : "idle",
  );
  const [kokoroLoadMsg, setKokoroLoadMsg] = useState<string | null>(null);
  const [kokoroTestPlaying, setKokoroTestPlaying] = useState(false);

  // Multi-select for language filter
  const [voiceLangs, setVoiceLangs] = useState<string[]>(() => {
    const loaded = loadTTSSettings();
    return Array.isArray(loaded.voiceLangs) ? loaded.voiceLangs : [];
  });
  const [browserVoices, setBrowserVoices] = useState<
    ReturnType<typeof getAvailableVoices>
  >([]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const updateVoices = () => {
      // Access getVoices() directly to bypass any wrapper caching
      const raw = synth.getVoices();
      if (raw.length > 0) {
        setBrowserVoices(
          raw.map((v) => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
          })),
        );
      }
    };

    synth.onvoiceschanged = updateVoices;
    synth.addEventListener?.("voiceschanged", updateVoices);

    // Try immediately, then at staggered intervals to catch all browser timing
    updateVoices();
    const timers = [
      setTimeout(updateVoices, 100),
      setTimeout(updateVoices, 500),
      setTimeout(updateVoices, 1000),
      setTimeout(updateVoices, 2500),
    ];

    return () => {
      timers.forEach(clearTimeout);
      synth.removeEventListener?.("voiceschanged", updateVoices);
      // Do NOT null out onvoiceschanged here — it can wipe a handler set by
      // another effect if this cleanup runs mid-StrictMode double-invoke.
    };
  }, []);

  useEffect(() => {
    const loaded = loadTTSSettings();
    // If this device can't run Kokoro (e.g. iOS), fall back to browser
    const provider =
      loaded.provider === "kokoro" && !canUseKokoro
        ? "browser"
        : loaded.provider;
    setSettings({ ...loaded, provider });
    setExtraPayloadJson(JSON.stringify(loaded.extraPayload ?? {}, null, 2));
    if (loaded.previewText) setTestText(loaded.previewText);

    const unsub = onKokoroStateChange(setKokoroLoadState);
    return unsub;
  }, []);

  const handleSave = () => {
    saveTTSSettings({ ...settings, previewText: testText });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!settings.apiUrl.trim()) {
      setTestStatus("Please enter an API URL first.");
      return;
    }

    setTestLoading(true);
    setTestStatus(null);

    try {
      const baseUrl = settings.apiUrl.replace(/\/+$/, "");
      const path = settings.apiPath || "/v1/audio/speech";
      const fullUrl = `${baseUrl}${path}`;
      const url = new URL(fullUrl);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (settings.apiKey.trim()) {
        headers["Authorization"] = `Bearer ${settings.apiKey}`;
      }

      const payload = buildTTSPayload(
        testText || "Test",
        settings.defaultVoiceId,
        1,
        settings,
      );

      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        setTestStatus(`Connection successful (${response.status})`);
      } else {
        const errorText = await response.text().catch(() => "");
        setTestStatus(
          `Server responded with status ${response.status}: ${errorText || response.statusText}`,
        );
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("URL")) {
        setTestStatus("Invalid URL format.");
      } else if (err instanceof Error) {
        setTestStatus(`Connection failed: ${err.message}`);
      } else {
        setTestStatus("Connection failed.");
      }
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
              activeTab === tab.id
                ? "text-accent-cyan border-b-2 border-accent-cyan bg-dark-panel"
                : "text-muted hover:text-light"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Voice Settings Tab */}
      {activeTab === "voice" && (
        <section className="card space-y-6">
          <div>
            <h2 className="text-xl font-bold text-light">Voice TTS Service</h2>
            <p className="text-muted text-sm mt-1">
              Configure an external text-to-speech API for higher quality voice
              output. When set to &quot;API&quot;, the app will call your TTS
              service instead of the browser&apos;s built-in speech synthesis.
            </p>
          </div>

          {/* Provider Toggle */}
          {/* Browser TTS Settings */}
          {settings.provider === "browser" && (
            <div className="space-y-4 border-t border-border pt-4">
              {/* Language Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-light font-semibold">
                    Filter by Language
                  </label>
                  {voiceLangs.length > 0 && (
                    <button
                      onClick={() => setVoiceLangs([])}
                      className="text-xs text-muted hover:text-light"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const availableCodes = new Set(
                      browserVoices.map((v) => v.lang.split("-")[0]),
                    );
                    const knownCodes = new Set(
                      KNOWN_VOICE_LANGS.map((l) => l.code),
                    );
                    const extraLangs = Array.from(availableCodes)
                      .filter((c) => !knownCodes.has(c))
                      .map((c) => ({ code: c, label: c }));
                    return [...KNOWN_VOICE_LANGS, ...extraLangs].map((lang) => {
                      const available = availableCodes.has(lang.code);
                      const selected = voiceLangs.includes(lang.code);
                      return (
                        <button
                          key={lang.code}
                          onClick={() =>
                            setVoiceLangs(
                              selected
                                ? voiceLangs.filter((l) => l !== lang.code)
                                : [...voiceLangs, lang.code],
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                            selected
                              ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                              : available
                                ? "border-border text-light hover:border-accent-cyan hover:text-accent-cyan"
                                : "border-border/40 text-muted/50"
                          }`}
                        >
                          {lang.label}
                        </button>
                      );
                    });
                  })()}
                </div>
                <p className="text-muted text-xs">
                  Tap to filter. Dimmed languages have no detected voices yet.
                </p>
              </div>
              {/* Voice List Preview */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-light font-semibold">
                    Available Voices
                  </label>
                  {browserVoices.length > 0 && (
                    <span className="text-xs text-muted">
                      {browserVoices.length} detected
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto border border-border rounded bg-dark-panel p-2 text-xs text-light">
                  {(() => {
                    // Normalize voice name for comparison: lowercase + collapse whitespace
                    const norm = (s: string) =>
                      s.toLowerCase().replace(/\s+/g, " ").trim();
                    const availableNamesNorm = new Set(
                      browserVoices.map((v) => norm(v.name)),
                    );
                    const isAvailable = (name: string) =>
                      availableNamesNorm.has(norm(name));

                    // Filter known voices by language selection
                    const langFiltered =
                      voiceLangs.length > 0
                        ? KNOWN_VOICES.filter((v) =>
                            voiceLangs.some((l) => v.lang.startsWith(l)),
                          )
                        : KNOWN_VOICES;

                    // Any detected voices not matched by known list
                    const knownNamesNorm = new Set(
                      KNOWN_VOICES.map((v) => norm(v.name)),
                    );
                    const extras = browserVoices
                      .filter((v) => !knownNamesNorm.has(norm(v.name)))
                      .filter(
                        (v) =>
                          voiceLangs.length === 0 ||
                          voiceLangs.some((l) => v.lang.startsWith(l)),
                      )
                      .map((v) => ({
                        name: v.name,
                        lang: v.lang,
                      }));

                    const allVoices = [...langFiltered, ...extras];
                    // Sort: available first, then alpha
                    allVoices.sort((a, b) => {
                      const aAvail = isAvailable(a.name) ? 0 : 1;
                      const bAvail = isAvailable(b.name) ? 0 : 1;
                      return aAvail - bAvail || a.name.localeCompare(b.name);
                    });

                    if (allVoices.length === 0)
                      return (
                        <span className="text-muted">
                          No voices found for selected language(s).
                        </span>
                      );
                    return allVoices.map((v) => {
                      const available = isAvailable(v.name);
                      return (
                        <div
                          key={v.name}
                          className={`flex items-center gap-2 py-0.5 ${available ? "" : "opacity-35"}`}
                        >
                          <span className="font-mono">{v.name}</span>
                          <span className="text-muted">({v.lang})</span>
                          {!available && (
                            <span className="ml-auto text-[10px] text-muted">
                              not available
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                {browserVoices.length === 0 && (
                  <p className="text-muted text-xs mt-1">
                    No voices detected yet — they may still be loading.
                  </p>
                )}
                {/* DEBUG: show raw names reported by the browser */}
                {browserVoices.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted cursor-pointer hover:text-light">
                      Debug: raw voice names from browser (
                      {browserVoices.length})
                    </summary>
                    <div className="mt-1 max-h-32 overflow-y-auto bg-dark-base rounded p-2 text-[10px] font-mono text-muted space-y-0.5">
                      {browserVoices.map((v) => (
                        <div key={v.voiceURI || v.name}>
                          &quot;{v.name}&quot; — {v.lang}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {isIOSDevice && (
                  <p className="text-muted text-xs mt-2 leading-relaxed">
                    <span className="text-accent-cyan font-semibold">
                      iOS tip:
                    </span>{" "}
                    To unlock high-quality HD voices, go to{" "}
                    <span className="text-light">
                      Settings → Accessibility → Spoken Content → Voices
                    </span>
                    , select your language, and download an{" "}
                    <span className="text-light">Enhanced</span> or{" "}
                    <span className="text-light">Premium</span> voice. They will
                    appear here automatically.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-light font-semibold">
              TTS Provider
            </label>
            <div
              className={`grid gap-3 ${canUseKokoro ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {(["browser", "kokoro", "api"] as const)
                .filter((p) => p !== "kokoro" || canUseKokoro)
                .map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setSettings({ ...settings, provider })}
                    className={`p-3 rounded border transition-all ${
                      settings.provider === provider
                        ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                        : "border-border text-muted hover:border-accent-cyan hover:text-light"
                    }`}
                  >
                    <div className="font-semibold">
                      {provider === "browser"
                        ? "Browser"
                        : provider === "kokoro"
                          ? "Kokoro AI"
                          : "External API"}
                    </div>
                    <div className="text-xs mt-1">
                      {provider === "browser"
                        ? "Built-in Web Speech API"
                        : provider === "kokoro"
                          ? "Local AI, no API needed"
                          : "Custom TTS service endpoint"}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Audio Caching — global, applies to all providers */}
          {settings.provider !== "browser" && (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-start gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.enableAudioCache ?? false}
                    onChange={(e) => {
                      const updated = {
                        ...settings,
                        enableAudioCache: e.target.checked,
                      };
                      setSettings(updated);
                      saveTTSSettings(updated);
                    }}
                    className="accent-accent-cyan w-4 h-4 mt-0.5"
                  />
                  <span className="text-light font-semibold">
                    💾 Cache generated audio
                  </span>
                </label>
                <p className="text-muted text-xs pt-0.5">
                  Saves TTS audio to browser storage so repeated lines —
                  including narration — are played back instantly without
                  regenerating.
                </p>
              </div>
              {(settings.enableAudioCache ?? false) && (
                <button
                  onClick={async () => {
                    const { clearAllCachedAudio } =
                      await import("@/lib/audio-cache");
                    await clearAllCachedAudio();
                    alert("Audio cache cleared.");
                  }}
                  className="text-xs text-muted hover:text-red-400 underline"
                >
                  Clear audio cache
                </button>
              )}
            </div>
          )}

          {/* Kokoro Settings */}
          {settings.provider === "kokoro" && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-1">
                <p className="text-muted text-sm">
                  Kokoro runs an AI voice model directly in your browser — no
                  account or API key needed. The model is downloaded once from
                  HuggingFace and cached locally.
                </p>
              </div>

              {/* Pre-generation Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-light font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.kokoroPreGenEnabled ?? true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        kokoroPreGenEnabled: e.target.checked,
                      })
                    }
                    className="accent-accent-cyan"
                  />
                  Enable pre-generation (faster playback)
                </label>
                <span className="text-muted text-xs">
                  When enabled, the next Kokoro line is generated in the
                  background for smoother playback.
                </span>
              </div>

              {/* Device selector */}
              <div className="space-y-2">
                <label className="block text-light font-semibold">
                  Compute Device
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {(["wasm", "webgpu"] as const).map((device) => {
                    const unavailable =
                      device === "webgpu" && !isWebGPUSupported();
                    const active = (settings.kokoroDevice ?? "wasm") === device;
                    return (
                      <button
                        key={device}
                        disabled={unavailable}
                        onClick={() => {
                          if (active) return;
                          resetKokoro();
                          setKokoroLoadState("idle");
                          setKokoroLoadMsg(null);
                          setSettings({ ...settings, kokoroDevice: device });
                        }}
                        className={`p-3 rounded border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          active
                            ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                            : "border-border text-muted hover:border-accent-cyan hover:text-light"
                        }`}
                      >
                        <div className="font-semibold text-sm">
                          {device === "wasm" ? "CPU (WASM)" : "GPU (WebGPU)"}
                        </div>
                        <div className="text-xs mt-0.5">
                          {device === "wasm"
                            ? "~80 MB · works everywhere"
                            : unavailable
                              ? "requires Chrome 113+"
                              : "~300 MB · 5–10× faster"}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {(settings.kokoroDevice ?? "wasm") === "webgpu" &&
                  isWebGPUSupported() && (
                    <p className="text-muted text-xs">
                      WebGPU uses your GPU for generation. Larger first download
                      (~164 MB) but significantly faster.
                    </p>
                  )}
              </div>

              {/* Model load status + button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    setKokoroLoadMsg(null);
                    try {
                      await loadKokoro({
                        device: settings.kokoroDevice ?? "wasm",
                        onProgress: (msg) => setKokoroLoadMsg(msg),
                      });
                      setKokoroLoadMsg(null);
                    } catch (err) {
                      setKokoroLoadMsg(
                        err instanceof Error ? err.message : "Load failed",
                      );
                    }
                  }}
                  disabled={
                    kokoroLoadState === "loading" || kokoroLoadState === "ready"
                  }
                  className={`px-4 py-2 rounded font-semibold text-sm transition-all ${
                    kokoroLoadState === "ready"
                      ? "bg-green-700 text-green-100 cursor-default"
                      : kokoroLoadState === "loading"
                        ? "bg-dark-panel text-muted cursor-wait"
                        : "bg-accent-cyan text-dark-base hover:bg-accent-cyan/80"
                  }`}
                >
                  {kokoroLoadState === "ready"
                    ? `Model Ready (${getKokoroLoadedDevice() ?? "wasm"})`
                    : kokoroLoadState === "loading"
                      ? "Loading…"
                      : kokoroLoadState === "error"
                        ? "Retry Load"
                        : "Load Model"}
                </button>
                {kokoroLoadMsg && (
                  <span className="text-muted text-xs">{kokoroLoadMsg}</span>
                )}
                {kokoroLoadState === "error" && !kokoroLoadMsg && (
                  <span className="text-red-400 text-xs">
                    Load failed — check console
                  </span>
                )}
              </div>

              {/* Default Voice */}
              <div className="space-y-2">
                <label className="block text-light font-semibold">
                  Default Voice
                </label>
                <select
                  value={settings.kokoroVoice || "am_puck"}
                  onChange={(e) =>
                    setSettings({ ...settings, kokoroVoice: e.target.value })
                  }
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan max-w-xs"
                >
                  {KOKORO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <p className="text-muted text-xs">
                  Used for any character that doesn&apos;t have its own voice
                  assigned.
                </p>
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-light font-semibold">
                    Default Speed
                  </label>
                  <span className="text-accent-cyan font-mono text-sm">
                    {(settings.kokoroSpeed ?? 1).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.kokoroSpeed ?? 1}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      kokoroSpeed: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-background border border-border rounded cursor-pointer max-w-xs"
                />
                <div className="flex justify-between text-xs text-muted max-w-xs">
                  <span>Slow (0.5x)</span>
                  <span>Normal (1x)</span>
                  <span>Fast (2x)</span>
                </div>
              </div>

              {/* Test */}
              <div className="space-y-3 border-t border-border pt-4">
                <label className="block text-light font-semibold">
                  Test Voice
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Enter test text…"
                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (kokoroTestPlaying) {
                        stopKokoroAudio();
                        setKokoroTestPlaying(false);
                        return;
                      }
                      if (kokoroLoadState !== "ready") {
                        setKokoroLoadMsg("Load the model first.");
                        return;
                      }
                      setKokoroTestPlaying(true);
                      try {
                        saveTTSSettings({ ...settings, previewText: testText });
                        await speakTextViaKokoro(testText, {
                          voice: settings.kokoroVoice || "am_puck",
                          speed: settings.kokoroSpeed ?? 1,
                        });
                      } catch (err) {
                        setKokoroLoadMsg(
                          err instanceof Error
                            ? err.message
                            : "Playback failed",
                        );
                      } finally {
                        setKokoroTestPlaying(false);
                      }
                    }}
                    disabled={!testText.trim()}
                    className="px-4 py-2 rounded font-semibold text-sm bg-accent-cyan text-dark-base hover:bg-accent-cyan/80 disabled:opacity-50"
                  >
                    {kokoroTestPlaying ? "Stop" : "Play"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Settings */}
          {settings.provider === "api" && (
            <div className="space-y-4 border-t border-border pt-4">
              {/* API Base URL */}
              <div className="space-y-2">
                <label
                  className="block text-light font-semibold"
                  htmlFor="apiUrl"
                >
                  API Base URL
                </label>
                <input
                  id="apiUrl"
                  type="url"
                  value={settings.apiUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, apiUrl: e.target.value })
                  }
                  placeholder="http://localhost:8880"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                />
                <p className="text-muted text-xs">
                  The base URL of your TTS service (without the path).
                </p>
              </div>

              {/* API Path */}
              <div className="space-y-2">
                <label
                  className="block text-light font-semibold"
                  htmlFor="apiPath"
                >
                  API Path
                </label>
                <input
                  id="apiPath"
                  type="text"
                  value={settings.apiPath}
                  onChange={(e) =>
                    setSettings({ ...settings, apiPath: e.target.value })
                  }
                  placeholder="/v1/audio/speech"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                />
                <p className="text-muted text-xs">
                  The endpoint path appended to the base URL. The app will POST
                  to this path.
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label
                  className="block text-light font-semibold"
                  htmlFor="apiKey"
                >
                  API Key{" "}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
                  }
                  placeholder="sk-..."
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                  autoComplete="off"
                />
                <p className="text-muted text-xs">
                  Sent as a Bearer token in the Authorization header. Stored
                  locally in your browser only.
                </p>
              </div>

              {/* Default Voice ID */}
              <div className="space-y-2">
                <label
                  className="block text-light font-semibold"
                  htmlFor="defaultVoiceId"
                >
                  Default Voice
                </label>
                <div className="flex gap-2">
                  {apiVoices.length > 0 ? (
                    <select
                      id="defaultVoiceId"
                      value={settings.defaultVoiceId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultVoiceId: e.target.value,
                        })
                      }
                      className="flex-1 bg-background border border-border rounded px-3 py-2 text-light focus:outline-none focus:border-accent-cyan"
                    >
                      <option value="">Select a voice...</option>
                      {apiVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name ? `${v.name} (${v.id})` : v.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="defaultVoiceId"
                      type="text"
                      value={settings.defaultVoiceId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultVoiceId: e.target.value,
                        })
                      }
                      placeholder="e.g. am_puck, alloy, nova..."
                      className="flex-1 bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                    />
                  )}
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setVoicesLoading(true);
                      setVoicesError(null);
                      try {
                        const voices = await fetchApiVoices(settings);
                        setApiVoices(voices);
                        if (voices.length === 0) {
                          setVoicesError("No voices returned by the API.");
                        }
                      } catch (err) {
                        setVoicesError(
                          err instanceof Error
                            ? err.message
                            : "Failed to load voices",
                        );
                      } finally {
                        setVoicesLoading(false);
                      }
                    }}
                    disabled={voicesLoading || !settings.apiUrl.trim()}
                  >
                    {voicesLoading ? "Loading..." : "Load Voices"}
                  </Button>
                </div>
                {voicesError && (
                  <p className="text-red-400 text-xs">{voicesError}</p>
                )}
                {apiVoices.length > 0 && (
                  <p className="text-muted text-xs">
                    {apiVoices.length} voice{apiVoices.length !== 1 ? "s" : ""}{" "}
                    available.
                  </p>
                )}
                <p className="text-muted text-xs">
                  The voice sent in the payload when no character-specific voice
                  is assigned. Click &quot;Load Voices&quot; to fetch available
                  voices from {settings.apiUrl || "your API"}.
                </p>
              </div>

              {/* Response Format */}
              <div className="space-y-2">
                <label
                  className="block text-light font-semibold"
                  htmlFor="responseFormat"
                >
                  Response Format
                </label>
                <input
                  id="responseFormat"
                  type="text"
                  value={settings.responseFormat}
                  onChange={(e) =>
                    setSettings({ ...settings, responseFormat: e.target.value })
                  }
                  placeholder="mp3"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan max-w-xs"
                />
                <p className="text-muted text-xs">
                  Audio format for the response (e.g. mp3, wav, opus).
                </p>
              </div>

              {/* Stream Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-light font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.stream}
                    onChange={(e) =>
                      setSettings({ ...settings, stream: e.target.checked })
                    }
                    className="accent-accent-cyan"
                  />
                  Stream response
                </label>
                <span className="text-muted text-xs">
                  Send stream: true in the request payload.
                </span>
              </div>

              {/* Extra Payload */}
              <div className="space-y-2">
                <label className="block text-light font-semibold">
                  Extra Payload Fields{" "}
                  <span className="text-muted font-normal">(JSON)</span>
                </label>
                <textarea
                  value={extraPayloadJson}
                  onChange={(e) => {
                    setExtraPayloadJson(e.target.value);
                    setExtraPayloadError(null);
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (
                        typeof parsed === "object" &&
                        parsed !== null &&
                        !Array.isArray(parsed)
                      ) {
                        setSettings({ ...settings, extraPayload: parsed });
                      } else {
                        setExtraPayloadError("Must be a JSON object {}");
                      }
                    } catch {
                      setExtraPayloadError("Invalid JSON");
                    }
                  }}
                  rows={4}
                  placeholder={
                    '{\n  "download_format": "mp3",\n  "return_download_link": true\n}'
                  }
                  className={`w-full bg-background border rounded px-3 py-2 text-light placeholder-muted focus:outline-none font-mono text-sm resize-vertical ${
                    extraPayloadError
                      ? "border-red-500"
                      : "border-border focus:border-accent-cyan"
                  }`}
                />
                {extraPayloadError && (
                  <p className="text-red-400 text-xs">{extraPayloadError}</p>
                )}
                <p className="text-muted text-xs">
                  Additional fields merged into every TTS request. The{" "}
                  <code className="text-accent-cyan">input</code>,{" "}
                  <code className="text-accent-cyan">voice</code>,{" "}
                  <code className="text-accent-cyan">speed</code>,{" "}
                  <code className="text-accent-cyan">response_format</code>, and{" "}
                  <code className="text-accent-cyan">stream</code> fields are
                  set automatically.
                </p>
              </div>

              {/* Payload Preview */}
              <div className="space-y-2">
                <label className="block text-muted font-semibold text-sm">
                  Payload Preview
                </label>
                <pre className="bg-background border border-border rounded p-3 text-xs text-muted overflow-x-auto font-mono">
                  {JSON.stringify(
                    {
                      ...settings.extraPayload,
                      input: "(your text here)",
                      voice: settings.defaultVoiceId || "(voice id)",
                      response_format: settings.responseFormat || "mp3",
                      speed: 1,
                      stream: settings.stream,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>

              {/* Test Connection */}
              <div className="space-y-3 border-t border-border pt-4">
                <label className="block text-light font-semibold">
                  Test Voice
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Enter test text..."
                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan text-sm"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleTestConnection}
                    disabled={testLoading || !settings.apiUrl.trim()}
                  >
                    {testLoading ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (testPlaying) {
                        stopApiAudio();
                        setTestPlaying(false);
                        return;
                      }
                      setTestPlaying(true);
                      setTestStatus(null);
                      try {
                        saveTTSSettings(settings);
                        await speakTextViaApi(testText, {
                          voice: settings.defaultVoiceId,
                        });
                        setTestStatus("Playback complete!");
                      } catch (err) {
                        setTestStatus(
                          err instanceof Error
                            ? err.message
                            : "Playback failed",
                        );
                      } finally {
                        setTestPlaying(false);
                      }
                    }}
                    disabled={!settings.apiUrl.trim() || !testText.trim()}
                  >
                    {testPlaying ? "⏹ Stop" : "▶ Play"}
                  </Button>
                </div>
                {testStatus && (
                  <span
                    className={`text-sm block ${
                      testStatus.startsWith("Connection successful") ||
                      testStatus === "Playback complete!"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {testStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button variant="primary" onClick={handleSave}>
              Save Settings
            </Button>
            {saved && (
              <span className="text-green-400 text-sm">Settings saved!</span>
            )}
          </div>
        </section>
      )}

      {/* Data Management Tab */}
      {activeTab === "data" && (
        <section className="card space-y-4">
          <div>
            <h2 className="text-xl font-bold text-light">Data Management</h2>
            <p className="text-muted text-sm mt-1">
              Export your data as a JSON backup file, or import a previous
              backup to restore. All data is stored locally in your browser.
            </p>
          </div>

          <DataManagementPanel />
        </section>
      )}

      {/* Build Info */}
      <div className="text-center text-muted text-xs pt-2 pb-1 space-y-0.5">
        <div>
          Theater Companion{" "}
          <span className="font-mono">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
        {process.env.NEXT_PUBLIC_BUILD_NUMBER !== "local" && (
          <div className="font-mono">
            build&nbsp;#{process.env.NEXT_PUBLIC_BUILD_NUMBER}
            &nbsp;&middot;&nbsp;
            {process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7)}
          </div>
        )}
      </div>
    </div>
  );
}
