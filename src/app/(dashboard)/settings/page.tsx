"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { TTSSettings } from "@/types/voice";
import { speakTextViaApi, stopApiAudio, buildTTSPayload, fetchApiVoices, ApiVoice } from "@/lib/voice";
import { exportData, importData, getStorageSummary } from "@/lib/data-export";

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

function DataManagementPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ReturnType<typeof getStorageSummary> | null>(null);
  const [importStatus, setImportStatus] = useState<{ message: string; error: boolean } | null>(null);

  useEffect(() => {
    setSummary(getStorageSummary());
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    try {
      const result = await importData(file);
      setImportStatus({
        message: `Restored ${result.keysRestored} items from backup (${result.exportedAt.slice(0, 10)}). Reload the page to see changes.`,
        error: false,
      });
      setSummary(getStorageSummary());
    } catch (err) {
      setImportStatus({
        message: err instanceof Error ? err.message : "Import failed.",
        error: true,
      });
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Projects", value: summary.projectCount },
            { label: "Scenes", value: summary.sceneCount },
            { label: "Characters", value: summary.characterCount },
            { label: "Size", value: `${summary.totalSizeKB} KB` },
          ].map((item) => (
            <div key={item.label} className="bg-dark-panel rounded p-3 text-center">
              <div className="text-2xl font-bold text-light">{item.value}</div>
              <div className="text-muted text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="primary" onClick={exportData}>
          Export Backup
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import Backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {importStatus && (
        <p className={`text-sm ${importStatus.error ? "text-red-400" : "text-green-400"}`}>
          {importStatus.message}
        </p>
      )}
    </div>
  );
}

type SettingsTab = "voice" | "data" | "about";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "voice", label: "Voice Settings" },
  { id: "data", label: "Data Management" },
  { id: "about", label: "About" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("voice");
  const [settings, setSettings] = useState<TTSSettings>(DEFAULT_TTS_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [extraPayloadJson, setExtraPayloadJson] = useState("{}");
  const [extraPayloadError, setExtraPayloadError] = useState<string | null>(null);
  const [testText, setTestText] = useState("Hello, this is a voice test.");
  const [testPlaying, setTestPlaying] = useState(false);
  const [apiVoices, setApiVoices] = useState<ApiVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadTTSSettings();
    setSettings(loaded);
    setExtraPayloadJson(JSON.stringify(loaded.extraPayload ?? {}, null, 2));
    if (loaded.previewText) setTestText(loaded.previewText);
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
        setTestStatus(`Server responded with status ${response.status}: ${errorText || response.statusText}`);
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
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-light">Settings</h1>

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
              Configure an external text-to-speech API for higher quality voice output.
              When set to &quot;API&quot;, the app will call your TTS service instead of the browser&apos;s built-in speech synthesis.
            </p>
          </div>

        {/* Provider Toggle */}
        <div className="space-y-2">
          <label className="block text-light font-semibold">TTS Provider</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(["browser", "api"] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => setSettings({ ...settings, provider })}
                className={`p-3 rounded border transition-all capitalize ${
                  settings.provider === provider
                    ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan"
                    : "border-border text-muted hover:border-accent-cyan hover:text-light"
                }`}
              >
                <div className="font-semibold">
                  {provider === "browser" ? "Browser" : "External API"}
                </div>
                <div className="text-xs mt-1">
                  {provider === "browser"
                    ? "Built-in Web Speech API"
                    : "Custom TTS service endpoint"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* API Settings (shown when API provider selected) */}
        {settings.provider === "api" && (
          <div className="space-y-4 border-t border-border pt-4">
            {/* API Base URL */}
            <div className="space-y-2">
              <label className="block text-light font-semibold" htmlFor="apiUrl">
                API Base URL
              </label>
              <input
                id="apiUrl"
                type="url"
                value={settings.apiUrl}
                onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                placeholder="http://localhost:8880"
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
              />
              <p className="text-muted text-xs">
                The base URL of your TTS service (without the path).
              </p>
            </div>

            {/* API Path */}
            <div className="space-y-2">
              <label className="block text-light font-semibold" htmlFor="apiPath">
                API Path
              </label>
              <input
                id="apiPath"
                type="text"
                value={settings.apiPath}
                onChange={(e) => setSettings({ ...settings, apiPath: e.target.value })}
                placeholder="/v1/audio/speech"
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
              />
              <p className="text-muted text-xs">
                The endpoint path appended to the base URL. The app will POST to this path.
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="block text-light font-semibold" htmlFor="apiKey">
                API Key <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="apiKey"
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-background border border-border rounded px-3 py-2 text-light placeholder-muted focus:outline-none focus:border-accent-cyan"
                autoComplete="off"
              />
              <p className="text-muted text-xs">
                Sent as a Bearer token in the Authorization header. Stored locally in your browser only.
              </p>
            </div>

            {/* Default Voice ID */}
            <div className="space-y-2">
              <label className="block text-light font-semibold" htmlFor="defaultVoiceId">
                Default Voice
              </label>
              <div className="flex gap-2">
                {apiVoices.length > 0 ? (
                  <select
                    id="defaultVoiceId"
                    value={settings.defaultVoiceId}
                    onChange={(e) => setSettings({ ...settings, defaultVoiceId: e.target.value })}
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
                    onChange={(e) => setSettings({ ...settings, defaultVoiceId: e.target.value })}
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
                      setVoicesError(err instanceof Error ? err.message : "Failed to load voices");
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
                  {apiVoices.length} voice{apiVoices.length !== 1 ? "s" : ""} available.
                </p>
              )}
              <p className="text-muted text-xs">
                The voice sent in the payload when no character-specific voice is assigned.
                Click &quot;Load Voices&quot; to fetch available voices from {settings.apiUrl || "your API"}.
              </p>
            </div>

            {/* Response Format */}
            <div className="space-y-2">
              <label className="block text-light font-semibold" htmlFor="responseFormat">
                Response Format
              </label>
              <input
                id="responseFormat"
                type="text"
                value={settings.responseFormat}
                onChange={(e) => setSettings({ ...settings, responseFormat: e.target.value })}
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
                  onChange={(e) => setSettings({ ...settings, stream: e.target.checked })}
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
                Extra Payload Fields <span className="text-muted font-normal">(JSON)</span>
              </label>
              <textarea
                value={extraPayloadJson}
                onChange={(e) => {
                  setExtraPayloadJson(e.target.value);
                  setExtraPayloadError(null);
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                      setSettings({ ...settings, extraPayload: parsed });
                    } else {
                      setExtraPayloadError("Must be a JSON object {}");
                    }
                  } catch {
                    setExtraPayloadError("Invalid JSON");
                  }
                }}
                rows={4}
                placeholder={'{\n  "download_format": "mp3",\n  "return_download_link": true\n}'}
                className={`w-full bg-background border rounded px-3 py-2 text-light placeholder-muted focus:outline-none font-mono text-sm resize-vertical ${
                  extraPayloadError ? "border-red-500" : "border-border focus:border-accent-cyan"
                }`}
              />
              {extraPayloadError && (
                <p className="text-red-400 text-xs">{extraPayloadError}</p>
              )}
              <p className="text-muted text-xs">
                Additional fields merged into every TTS request. The <code className="text-accent-cyan">input</code>, <code className="text-accent-cyan">voice</code>, <code className="text-accent-cyan">speed</code>, <code className="text-accent-cyan">response_format</code>, and <code className="text-accent-cyan">stream</code> fields are set automatically.
              </p>
            </div>

            {/* Payload Preview */}
            <div className="space-y-2">
              <label className="block text-muted font-semibold text-sm">Payload Preview</label>
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
              <label className="block text-light font-semibold">Test Voice</label>
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
                      // Save current settings first so speakTextViaApi reads them
                      saveTTSSettings(settings);
                      await speakTextViaApi(testText, {
                        voice: settings.defaultVoiceId,
                      });
                      setTestStatus("Playback complete!");
                    } catch (err) {
                      setTestStatus(
                        err instanceof Error ? err.message : "Playback failed",
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
                    testStatus.startsWith("Connection successful") || testStatus === "Playback complete!"
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
              Export your data as a JSON backup file, or import a previous backup to restore.
              All data is stored locally in your browser.
            </p>
          </div>

          <DataManagementPanel />
        </section>
      )}

      {/* About Tab */}
      {activeTab === "about" && (
        <section className="card space-y-6">
          <div>
            <h2 className="text-xl font-bold text-light">About</h2>
            <p className="text-muted text-sm mt-1">
              Theater Rehearsal Manager v0.1.0
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-light">Getting Started</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted text-sm">
              <li><span className="text-light font-medium">Create a Project</span> — Go to the <span className="text-accent-cyan">Projects</span> page and create a new production. Each project keeps its scenes, cast, and rehearsal settings separate.</li>
              <li><span className="text-light font-medium">Import Scenes</span> — In the <span className="text-accent-cyan">Rehearse</span> section, select the <span className="text-accent-cyan">Scenes</span> tab and paste or import your script text. The parser will split it into character lines and stage directions automatically.</li>
              <li><span className="text-light font-medium">Set Up Cast</span> — In <span className="text-accent-cyan">Rehearse</span>, switch to the <span className="text-accent-cyan">Cast</span> tab to see your characters. You can assign voices to each character for text-to-speech playback.</li>
              <li><span className="text-light font-medium">Configure Voices</span> — In <span className="text-accent-cyan">Settings</span> &rarr; <span className="text-accent-cyan">Voice Settings</span>, choose between the built-in browser speech or connect an external TTS API for higher quality voices.</li>
              <li><span className="text-light font-medium">Run Lines</span> — In <span className="text-accent-cyan">Rehearse</span>, open the <span className="text-accent-cyan">Run Lines</span> tab, select your scene and the character you&apos;re playing. The app will read the other characters&apos; lines aloud and pause for yours.</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-light">Tips</h3>
            <ul className="list-disc list-inside space-y-2 text-muted text-sm">
              <li>Use the <span className="text-accent-cyan">Data Management</span> tab to export backups of your work regularly.</li>
              <li>Voice settings saved on the Cast page carry over to rehearsals automatically.</li>
              <li>You can assign different API voices per character for a more realistic rehearsal experience.</li>
              <li>Scene import supports standard script formats — character names in UPPERCASE followed by their dialogue.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-light">Contact & Feedback</h3>
            <div className="space-y-3 text-muted text-sm">
              <p>
                Have suggestions, found a bug, or need help? I&apos;d love to hear from you:
              </p>
              
              <div className="bg-dark-panel rounded p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <div className="text-light font-medium">Email</div>
                    <p className="text-xs">General feedback, questions, or collaboration</p>
                    <a 
                      href="mailto:joe@dinicola.com?subject=Theater%20Companion%20Feedback" 
                      className="text-accent-cyan hover:underline text-xs"
                    >
                      joe@joedinicola.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-muted text-xs">
              All data is stored locally in your browser. Nothing is sent to any server except the TTS endpoint you configure. API keys never leave your machine.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
