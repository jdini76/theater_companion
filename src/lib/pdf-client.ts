/**
 * Client-side PDF text extraction using pdf.js loaded from CDN.
 * Uses dynamic import with webpackIgnore to bypass bundling.
 * Runs entirely in the browser — no server required.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const PDFJS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs";
const PDFJS_WORKER_CDN_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs";

interface PdfjsLib {
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<PdfDocument>;
  };
  GlobalWorkerOptions: { workerSrc: string };
}

interface PdfDocument {
  numPages: number;
  getPage: (num: number) => Promise<PdfPage>;
}

interface PdfPage {
  getTextContent: () => Promise<{
    items: Array<{
      str?: string;
      hasEOL?: boolean;
      transform?: number[];
      width?: number;
      height?: number;
    }>;
  }>;
}

let pdfjsPromise: Promise<PdfjsLib> | null = null;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPod|iPad/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = import(
    /* webpackIgnore: true */
    PDFJS_CDN_URL
  ).then((mod: PdfjsLib) => {
    // iOS Safari blocks cross-origin module workers — disable the worker so
    // pdf.js falls back to running on the main thread.
    mod.GlobalWorkerOptions.workerSrc = isIOS() ? "" : PDFJS_WORKER_CDN_URL;
    return mod;
  });

  return pdfjsPromise;
}

/**
 * Reconstruct readable text from pdf.js text items, preserving line breaks
 * and inserting spaces between items on the same line.
 *
 * pdf.js getTextContent() returns items where each item is a text fragment.
 * Items on the same line have similar Y positions in their transform.
 * A significant Y shift means a new line. Horizontal gaps between items
 * on the same line need a space inserted.
 */
function reconstructText(
  items: Array<{
    str?: string;
    hasEOL?: boolean;
    transform?: number[];
    width?: number;
    height?: number;
  }>,
): string {
  const parts: string[] = [];
  let prevY: number | null = null;
  let prevEndX: number | null = null;

  for (const item of items) {
    if (typeof item.str !== "string") continue;
    // Skip empty strings (but honor hasEOL on them)
    if (item.str === "" && item.hasEOL) {
      parts.push("\n");
      prevY = null;
      prevEndX = null;
      continue;
    }
    if (item.str === "") continue;

    const tx = item.transform;
    if (tx && tx.length >= 6) {
      const x = tx[4];
      const y = tx[5];
      const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 12;

      if (prevY !== null) {
        // Detect line break: Y position shifted by more than half font size
        const yDelta = Math.abs(y - prevY);
        if (yDelta > fontSize * 0.3) {
          // New line
          parts.push("\n");
          prevEndX = null;
        } else if (prevEndX !== null) {
          // Same line — check if we need a space between items
          const gap = x - prevEndX;
          // Insert space if gap is larger than ~30% of font size
          // (catches word separation; avoids inserting within ligatures)
          if (gap > fontSize * 0.15) {
            parts.push(" ");
          }
        }
      }

      parts.push(item.str);

      prevY = y;
      // Estimate end X position: start X + item width
      prevEndX = x + (item.width ?? item.str.length * fontSize * 0.5);
    } else {
      // No transform data — fall back to hasEOL-based reconstruction
      if (parts.length > 0 && item.str.length > 0) {
        const lastChar = parts[parts.length - 1].slice(-1);
        // Add space if previous part didn't end with whitespace/newline
        if (lastChar && lastChar !== "\n" && lastChar !== " ") {
          parts.push(" ");
        }
      }
      parts.push(item.str);
      prevY = null;
      prevEndX = null;
    }

    if (item.hasEOL) {
      parts.push("\n");
      prevY = null;
      prevEndX = null;
    }
  }

  return parts.join("");
}

/**
 * Extract all text from a PDF file in the browser.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("File too large (max 10 MB)");
  }

  const pdfjs = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(reconstructText(content.items));
  }

  return pages.join("\n");
}
