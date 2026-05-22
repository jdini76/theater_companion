/**
 * Voice cache backup and restore.
 *
 * Supports four destinations:
 *  1. ZIP file  — download/upload, works everywhere, no account needed
 *  2. Folder    — File System Access API; on Mac/iPad the picker shows iCloud Drive
 *  3. Google Drive — PKCE OAuth, requires NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *  4. Dropbox      — PKCE OAuth, requires NEXT_PUBLIC_DROPBOX_APP_KEY
 *
 * All four destinations share the same manifest format so backups are
 * interchangeable across destinations.
 */

import JSZipLib from "jszip";
import { getAllCachedAudio, cacheAudioFile } from "@/lib/audio-cache";
import type { CachedAudio } from "@/lib/audio-cache";

// Defensive resolution: handle both ESM default and CJS direct-export shapes.
const JSZip: typeof JSZipLib =
  (JSZipLib as unknown as { default: typeof JSZipLib }).default ?? JSZipLib;

// ─── Shared manifest format ───────────────────────────────────────────────────

interface ManifestEntry {
  filename: string;
  key: string;
  characterName: string;
  text: string;
  createdAt: number;
}

const MANIFEST_NAME = "voice-cache-manifest.json";
const BACKUP_DIR = "voice-cache";
const DRIVE_FOLDER_NAME = "Theater Voice Cache";
const DROPBOX_PATH = "/Theater Voice Cache";

type ProgressFn = (done: number, total: number) => void;

function buildManifest(entries: CachedAudio[]): ManifestEntry[] {
  return entries.map((e, i) => ({
    filename: `audio_${i}.${e.blob.type === "audio/mpeg" ? "mp3" : "wav"}`,
    key: e.key,
    characterName: e.characterName,
    text: e.text,
    createdAt: e.createdAt,
  }));
}

function extOf(entry: ManifestEntry): string {
  return entry.filename.split(".").pop() ?? "wav";
}

function mimeOf(entry: ManifestEntry): string {
  return extOf(entry) === "mp3" ? "audio/mpeg" : "audio/wav";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function randomString(len: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}

// ─── OAuth popup ──────────────────────────────────────────────────────────────

function openOAuthPopup(
  url: string,
  expectedState: string,
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      url,
      "oauth-popup",
      "width=520,height=640,scrollbars=yes",
    );
    if (!popup) {
      reject(
        new Error(
          "Popup was blocked. Please allow popups for this page and try again.",
        ),
      );
      return;
    }

    let closedCheck: ReturnType<typeof setInterval>;

    const cleanup = () => {
      window.removeEventListener("message", handler);
      clearInterval(closedCheck);
    };

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-callback") return;
      if (event.data.state !== expectedState) return; // CSRF guard
      cleanup();
      if (event.data.error) {
        reject(new Error(`OAuth error: ${String(event.data.error)}`));
      } else {
        resolve({ code: event.data.code as string });
      }
    };

    window.addEventListener("message", handler);

    closedCheck = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Authentication was cancelled."));
      }
    }, 500);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Combined project-data + audio ZIP (single-production export/import)
// ═══════════════════════════════════════════════════════════════════════════════

const PROJECT_DATA_FILE = "project-data.json";

/**
 * Export a project payload (ExportDataV2) together with a filtered set of
 * audio cache entries as a single ZIP file.
 */
export async function exportProjectZip(
  payload: import("@/lib/data-export").ExportDataV2,
  audioEntries: CachedAudio[],
  filename: string,
): Promise<{ audioCount: number }> {
  const zip = new JSZip();
  zip.file(PROJECT_DATA_FILE, JSON.stringify(payload, null, 2));

  if (audioEntries.length > 0) {
    const dir = zip.folder(BACKUP_DIR)!;
    const manifest = buildManifest(audioEntries);
    dir.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));
    audioEntries.forEach((e, i) => dir.file(manifest[i].filename, e.blob));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, filename);
  return { audioCount: audioEntries.length };
}

/**
 * Parse a combined project ZIP. Returns the project payload (ready for
 * parseImportData) and any audio entries it contains.
 */
export async function extractFromProjectZip(file: File): Promise<{
  projectData: import("@/lib/data-export").ExportDataV2;
  audioEntries: CachedAudio[];
}> {
  const zip = await JSZip.loadAsync(file);

  const projectFile = zip.file(PROJECT_DATA_FILE);
  if (!projectFile)
    throw new Error("Invalid export file — missing project-data.json.");

  const projectData = JSON.parse(
    await projectFile.async("string"),
  ) as import("@/lib/data-export").ExportDataV2;

  const audioEntries: CachedAudio[] = [];
  const manifestFile = zip.file(`${BACKUP_DIR}/${MANIFEST_NAME}`);
  if (manifestFile) {
    const manifest: ManifestEntry[] = JSON.parse(
      await manifestFile.async("string"),
    );
    for (const entry of manifest) {
      const audioFile = zip.file(`${BACKUP_DIR}/${entry.filename}`);
      if (!audioFile) continue;
      const buf = await audioFile.async("arraybuffer");
      audioEntries.push({
        key: entry.key,
        characterName: entry.characterName,
        text: entry.text,
        blob: new Blob([buf], { type: mimeOf(entry) }),
        createdAt: entry.createdAt,
      });
    }
  }

  return { projectData, audioEntries };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ZIP
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportAsZip(
  onProgress?: ProgressFn,
): Promise<{ uploaded: number }> {
  const entries = await getAllCachedAudio();
  if (entries.length === 0) throw new Error("No cached audio files to export.");

  const zip = new JSZip();
  const dir = zip.folder(BACKUP_DIR)!;
  const manifest = buildManifest(entries);

  dir.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));
  entries.forEach((e, i) => {
    onProgress?.(i, entries.length);
    dir.file(manifest[i].filename, e.blob);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `voice-cache-${todayStr()}.zip`);
  onProgress?.(entries.length, entries.length);
  return { uploaded: entries.length };
}

export async function importFromZip(
  file: File,
  onProgress?: ProgressFn,
): Promise<{ imported: number; skipped: number }> {
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file(`${BACKUP_DIR}/${MANIFEST_NAME}`);
  if (!manifestFile)
    throw new Error("Invalid backup file — missing manifest.json.");

  const manifest: ManifestEntry[] = JSON.parse(
    await manifestFile.async("string"),
  );
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < manifest.length; i++) {
    onProgress?.(i, manifest.length);
    const entry = manifest[i];
    const audioFile = zip.file(`${BACKUP_DIR}/${entry.filename}`);
    if (!audioFile) {
      skipped++;
      continue;
    }
    const buf = await audioFile.async("arraybuffer");
    await cacheAudioFile(
      entry.characterName,
      entry.text,
      new Blob([buf], { type: mimeOf(entry) }),
    );
    imported++;
  }

  onProgress?.(manifest.length, manifest.length);
  return { imported, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Local folder  (iCloud Drive on Mac / iPad when user picks that folder)
// ═══════════════════════════════════════════════════════════════════════════════

export function isFolderAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function getDirectoryPicker():
  | ((options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>)
  | null {
  if (typeof window === "undefined") return null;
  return (
    (
      window as Window & {
        showDirectoryPicker?: (options?: {
          mode?: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker ?? null
  );
}

export async function exportToFolder(
  onProgress?: ProgressFn,
): Promise<{ uploaded: number }> {
  // showDirectoryPicker is in the File System Access API (TypeScript DOM lib)
  const showDirectoryPicker = getDirectoryPicker();
  if (!showDirectoryPicker) {
    throw new Error("Folder access is not supported in this browser.");
  }

  const dirHandle = await showDirectoryPicker({ mode: "readwrite" });
  const entries = await getAllCachedAudio();
  if (entries.length === 0) throw new Error("No cached audio files to export.");

  const manifest = buildManifest(entries);
  const mh = await dirHandle.getFileHandle(MANIFEST_NAME, { create: true });
  const mw = await mh.createWritable();
  await mw.write(JSON.stringify(manifest, null, 2));
  await mw.close();

  for (let i = 0; i < entries.length; i++) {
    onProgress?.(i, entries.length);
    const fh = await dirHandle.getFileHandle(manifest[i].filename, {
      create: true,
    });
    const fw = await fh.createWritable();
    await fw.write(entries[i].blob);
    await fw.close();
  }

  onProgress?.(entries.length, entries.length);
  return { uploaded: entries.length };
}

export async function importFromFolder(
  onProgress?: ProgressFn,
): Promise<{ imported: number; skipped: number }> {
  const showDirectoryPicker = getDirectoryPicker();
  if (!showDirectoryPicker) {
    throw new Error("Folder access is not supported in this browser.");
  }

  const dirHandle = await showDirectoryPicker({ mode: "read" });

  let mh: FileSystemFileHandle;
  try {
    mh = await dirHandle.getFileHandle(MANIFEST_NAME);
  } catch {
    throw new Error(
      "No backup found in this folder — missing voice-cache-manifest.json.",
    );
  }

  const manifest: ManifestEntry[] = JSON.parse(
    await (await mh.getFile()).text(),
  );
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < manifest.length; i++) {
    onProgress?.(i, manifest.length);
    const entry = manifest[i];
    try {
      const fh = await dirHandle.getFileHandle(entry.filename);
      const file = await fh.getFile();
      await cacheAudioFile(
        entry.characterName,
        entry.text,
        new Blob([await file.arrayBuffer()], { type: mimeOf(entry) }),
      );
      imported++;
    } catch {
      skipped++;
    }
  }

  onProgress?.(manifest.length, manifest.length);
  return { imported, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Google Drive
//    Requires: NEXT_PUBLIC_GOOGLE_CLIENT_ID
//    App must have /oauth-callback whitelisted as a redirect URI in Google Cloud Console.
// ═══════════════════════════════════════════════════════════════════════════════

export function isGoogleDriveConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

async function getGoogleToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId)
    throw new Error(
      "Google Drive is not configured — set NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
    );

  const { verifier, challenge } = await generatePKCE();
  const state = randomString(16);
  const redirectUri = `${window.location.origin}/oauth-callback`;

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
    {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      access_type: "online",
    },
  )}`;

  const { code } = await openOAuthPopup(url, state);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = (await tokenRes.json().catch(() => ({}))) as Record<
      string,
      string
    >;
    throw new Error(
      `Google token exchange failed: ${err.error_description ?? tokenRes.statusText}`,
    );
  }
  return ((await tokenRes.json()) as Record<string, string>).access_token;
}

async function driveJson(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function driveFindOrCreateFolder(token: string): Promise<string> {
  const q = `name='${DRIVE_FOLDER_NAME}' and trashed=false and mimeType='application/vnd.google-apps.folder'`;
  const list = await driveJson(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
  );
  const files = list.files as { id: string }[] | undefined;
  if (files?.length) return files[0].id;

  const folder = await driveJson(
    token,
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
  );
  return folder.id as string;
}

async function driveUploadFile(
  token: string,
  folderId: string,
  name: string,
  blob: Blob,
): Promise<void> {
  const q = `name='${name}' and '${folderId}' in parents and trashed=false`;
  const existing = await driveJson(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
  );
  const existingId = (existing.files as { id: string }[] | undefined)?.[0]?.id;

  const meta = existingId ? {} : { name, parents: [folderId] };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(meta)], { type: "application/json" }),
  );
  form.append("file", blob);

  const uploadUrl = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(uploadUrl, {
    method: existingId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.statusText}`);
}

async function driveDownloadFile(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.statusText}`);
  return res.blob();
}

export async function exportToGoogleDrive(
  onProgress?: ProgressFn,
): Promise<{ uploaded: number }> {
  const token = await getGoogleToken();
  const folderId = await driveFindOrCreateFolder(token);
  const entries = await getAllCachedAudio();
  if (entries.length === 0) throw new Error("No cached audio files to export.");

  const manifest = buildManifest(entries);
  await driveUploadFile(
    token,
    folderId,
    MANIFEST_NAME,
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
  );

  for (let i = 0; i < entries.length; i++) {
    onProgress?.(i, entries.length);
    await driveUploadFile(
      token,
      folderId,
      manifest[i].filename,
      entries[i].blob,
    );
  }

  onProgress?.(entries.length, entries.length);
  return { uploaded: entries.length };
}

export async function importFromGoogleDrive(
  onProgress?: ProgressFn,
): Promise<{ imported: number; skipped: number }> {
  const token = await getGoogleToken();
  const folderId = await driveFindOrCreateFolder(token);

  const q = `'${folderId}' in parents and trashed=false`;
  const list = await driveJson(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
  );
  const files = (list.files as { id: string; name: string }[]) ?? [];
  const manifestMeta = files.find((f) => f.name === MANIFEST_NAME);
  if (!manifestMeta)
    throw new Error(
      "No backup found in Google Drive (Theater Voice Cache folder).",
    );

  const manifestBlob = await driveDownloadFile(token, manifestMeta.id);
  const manifest: ManifestEntry[] = JSON.parse(await manifestBlob.text());
  const fileMap = new Map(files.map((f) => [f.name, f.id]));

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < manifest.length; i++) {
    onProgress?.(i, manifest.length);
    const entry = manifest[i];
    const fileId = fileMap.get(entry.filename);
    if (!fileId) {
      skipped++;
      continue;
    }
    try {
      const blob = await driveDownloadFile(token, fileId);
      await cacheAudioFile(
        entry.characterName,
        entry.text,
        new Blob([await blob.arrayBuffer()], { type: mimeOf(entry) }),
      );
      imported++;
    } catch {
      skipped++;
    }
  }

  onProgress?.(manifest.length, manifest.length);
  return { imported, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Dropbox
//    Requires: NEXT_PUBLIC_DROPBOX_APP_KEY
//    App must have /oauth-callback whitelisted as a redirect URI in the Dropbox App Console.
// ═══════════════════════════════════════════════════════════════════════════════

export function isDropboxConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
}

async function getDropboxToken(): Promise<string> {
  const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
  if (!appKey)
    throw new Error(
      "Dropbox is not configured — set NEXT_PUBLIC_DROPBOX_APP_KEY.",
    );

  const { verifier, challenge } = await generatePKCE();
  const state = randomString(16);
  const redirectUri = `${window.location.origin}/oauth-callback`;

  const url = `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    token_access_type: "online",
  })}`;

  const { code } = await openOAuthPopup(url, state);

  const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = (await tokenRes.json().catch(() => ({}))) as Record<
      string,
      string
    >;
    throw new Error(
      `Dropbox token exchange failed: ${err.error_description ?? tokenRes.statusText}`,
    );
  }
  return ((await tokenRes.json()) as Record<string, string>).access_token;
}

async function dropboxUpload(
  token: string,
  path: string,
  blob: Blob,
): Promise<void> {
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
      "Content-Type": "application/octet-stream",
    },
    body: blob,
  });
  if (!res.ok) throw new Error(`Dropbox upload failed: ${res.statusText}`);
}

async function dropboxListFolder(
  token: string,
): Promise<{ name: string; path_lower: string }[]> {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: DROPBOX_PATH }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (err?.error_summary?.startsWith("path/not_found")) return [];
    throw new Error(`Dropbox list failed: ${res.statusText}`);
  }
  return (
    (await res.json()) as { entries: { name: string; path_lower: string }[] }
  ).entries;
}

async function dropboxDownload(token: string, path: string): Promise<Blob> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error(`Dropbox download failed: ${res.statusText}`);
  return res.blob();
}

export async function exportToDropbox(
  onProgress?: ProgressFn,
): Promise<{ uploaded: number }> {
  const token = await getDropboxToken();
  const entries = await getAllCachedAudio();
  if (entries.length === 0) throw new Error("No cached audio files to export.");

  const manifest = buildManifest(entries);
  await dropboxUpload(
    token,
    `${DROPBOX_PATH}/${MANIFEST_NAME}`,
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
  );

  for (let i = 0; i < entries.length; i++) {
    onProgress?.(i, entries.length);
    await dropboxUpload(
      token,
      `${DROPBOX_PATH}/${manifest[i].filename}`,
      entries[i].blob,
    );
  }

  onProgress?.(entries.length, entries.length);
  return { uploaded: entries.length };
}

export async function importFromDropbox(
  onProgress?: ProgressFn,
): Promise<{ imported: number; skipped: number }> {
  const token = await getDropboxToken();
  const files = await dropboxListFolder(token);
  const manifestEntry = files.find((f) => f.name === MANIFEST_NAME);
  if (!manifestEntry)
    throw new Error("No backup found in Dropbox (Theater Voice Cache folder).");

  const manifestBlob = await dropboxDownload(token, manifestEntry.path_lower);
  const manifest: ManifestEntry[] = JSON.parse(await manifestBlob.text());
  const fileMap = new Map(files.map((f) => [f.name, f.path_lower]));

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < manifest.length; i++) {
    onProgress?.(i, manifest.length);
    const entry = manifest[i];
    const path = fileMap.get(entry.filename);
    if (!path) {
      skipped++;
      continue;
    }
    try {
      const blob = await dropboxDownload(token, path);
      await cacheAudioFile(
        entry.characterName,
        entry.text,
        new Blob([await blob.arrayBuffer()], { type: mimeOf(entry) }),
      );
      imported++;
    } catch {
      skipped++;
    }
  }

  onProgress?.(manifest.length, manifest.length);
  return { imported, skipped };
}
