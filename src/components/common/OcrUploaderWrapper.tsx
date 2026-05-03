import React, { useState } from "react";

// --- CDN URLs (webpackIgnore bypasses bundling for both libraries) ---
const PDFJS_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs";
const PDFJS_WORKER_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js";
const TESSERACT_WORKER_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js";
const TESSERACT_CORE_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0";
const TESSERACT_LANG_URL = "https://tessdata.projectnaptha.com/4.0.0";

// --- pdfjs-dist loader ---
interface PdfjsLib {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
  GlobalWorkerOptions: { workerSrc: string };
}
interface PdfDoc {
  numPages: number;
  getPage: (num: number) => Promise<PdfPage>;
}
interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
}
interface PdfPage {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
  getTextContent: (params?: {
    includeMarkedContent?: boolean;
  }) => Promise<{ items: PdfTextItem[] }>;
}
interface PdfViewport {
  width: number;
  height: number;
}

let pdfjsWorkerBlobUrl: string | null = null;
async function getWorkerSrc(): Promise<string> {
  if (pdfjsWorkerBlobUrl) return pdfjsWorkerBlobUrl;
  try {
    const res = await fetch(PDFJS_WORKER_CDN);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const code = await res.text();
    const blob = new Blob([code], { type: "text/javascript" });
    pdfjsWorkerBlobUrl = URL.createObjectURL(blob);
    return pdfjsWorkerBlobUrl;
  } catch {
    // Fetch failed — fall back to direct CDN URL
    return PDFJS_WORKER_CDN;
  }
}

let pdfjsPromise: Promise<PdfjsLib> | null = null;
function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = Promise.all([
    import(/* webpackIgnore: true */ PDFJS_CDN) as Promise<unknown>,
    getWorkerSrc(),
  ]).then(([mod, workerSrc]) => {
    // iOS Safari ESM imports may expose the library on .default
    const raw = mod as Record<string, unknown>;
    const lib = (raw.getDocument ? raw : raw.default) as PdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = workerSrc as string;
    return lib;
  });
  return pdfjsPromise;
}

/**
 * Try to extract selectable text from a PDF via the text layer.
 * Returns the text if meaningful content is found, or null if the PDF
 * appears to be image-only (scanned, no text layer).
 */
async function tryPdfTextLayer(
  arrayBuffer: ArrayBuffer,
): Promise<string | null> {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ includeMarkedContent: false });
    let pageText = "";
    let prevY: number | null = null;
    let prevEndX: number | null = null;

    for (const item of content.items) {
      if (typeof item.str !== "string" || item.str === "") {
        if (item.hasEOL) {
          pageText += "\n";
          prevY = null;
          prevEndX = null;
        }
        continue;
      }
      const tx = item.transform;
      if (tx && tx.length >= 6) {
        const x = tx[4];
        const y = tx[5];
        const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 12;
        if (prevY !== null) {
          if (Math.abs(y - prevY) > fontSize * 0.3) {
            pageText += "\n";
            prevEndX = null;
          } else if (prevEndX !== null && x - prevEndX > fontSize * 0.15) {
            pageText += " ";
          }
        }
        pageText += item.str;
        prevY = y;
        prevEndX = x + (item.width ?? item.str.length * fontSize * 0.5);
      } else {
        if (pageText.length > 0 && !/[\n ]$/.test(pageText)) pageText += " ";
        pageText += item.str;
        prevY = null;
        prevEndX = null;
      }
      if (item.hasEOL) {
        pageText += "\n";
        prevY = null;
        prevEndX = null;
      }
    }
    totalChars += pageText.replace(/\s/g, "").length;
    pageTexts.push(pageText);
  }

  // If fewer than 80 non-whitespace chars across the whole doc, treat as image-only
  if (totalChars < 80) return null;
  return pageTexts.join("\n");
}

// --- tesseract.js loader ---
interface TesseractWorker {
  recognize: (image: string | File) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
}
interface TesseractModule {
  createWorker: (
    langs: string,
    oem: number,
    options: Record<string, unknown>,
  ) => Promise<TesseractWorker>;
}

let tesseractPromise: Promise<TesseractModule> | null = null;
function loadTesseract(): Promise<TesseractModule> {
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = import(/* webpackIgnore: true */ TESSERACT_CDN).then(
    (mod: any) => {
      // CDN ESM builds may export on default or as named exports
      return (mod.createWorker ? mod : mod.default) as TesseractModule;
    },
  );
  return tesseractPromise;
}

async function runOcr(
  image: string | File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker("eng", 1, {
    workerPath: TESSERACT_WORKER_URL,
    corePath: TESSERACT_CORE_URL,
    langPath: TESSERACT_LANG_URL,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const { data } = await worker.recognize(image);
  await worker.terminate();
  return data.text;
}

// --- Components ---
export function OcrUploaderWrapper({
  onExtract,
}: {
  onExtract: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div>
      <OcrUploaderWithCallback
        onExtract={(t) => {
          setText(t);
          onExtract(t);
        }}
      />
      {text && (
        <textarea
          className="w-full mt-2 p-2 border rounded"
          rows={8}
          value={text}
          readOnly
        />
      )}
    </div>
  );
}

function OcrUploaderWithCallback(props: { onExtract: (text: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setProgress(0);
    }
  };

  const handleOcr = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        const arrayBuffer = await file.arrayBuffer();

        // First, try to extract the text layer (fast, no OCR, works on iOS).
        const textLayerResult = await tryPdfTextLayer(arrayBuffer);
        if (textLayerResult !== null) {
          props.onExtract(textLayerResult);
          return;
        }

        // Text layer had no content — fall back to OCR (render each page → Tesseract).
        const pdfjsLib = await loadPdfjs();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const { createWorker } = await loadTesseract();

        let currentPage = 0;
        const worker = await createWorker("eng", 1, {
          workerPath: TESSERACT_WORKER_URL,
          corePath: TESSERACT_CORE_URL,
          langPath: TESSERACT_LANG_URL,
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgress(
                Math.round((100 * (currentPage + m.progress)) / pdf.numPages),
              );
            }
          },
        });

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          currentPage = i - 1;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport, canvas })
            .promise;
          const { data } = await worker.recognize(
            canvas.toDataURL("image/png"),
          );
          fullText += data.text + "\n";
        }
        await worker.terminate();
        props.onExtract(fullText);
      } else {
        const text = await runOcr(file, setProgress);
        props.onExtract(text);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setError(
        `OCR failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      props.onExtract("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="mb-2"
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={handleOcr}
        disabled={!file || loading}
      >
        {loading ? "Processing..." : "Extract Text"}
      </button>
      {progress > 0 && loading && (
        <div className="mt-2">Progress: {progress}%</div>
      )}
      {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
    </div>
  );
}
