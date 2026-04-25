import React, { useState } from "react";

// --- CDN URLs (webpackIgnore bypasses bundling for both libraries) ---
const PDFJS_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs";
const PDFJS_WORKER_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs";

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js";
const TESSERACT_WORKER_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js";
const TESSERACT_CORE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0";
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
interface PdfPage {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
}
interface PdfViewport { width: number; height: number }

let pdfjsPromise: Promise<PdfjsLib> | null = null;
function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import(
    /* webpackIgnore: true */ PDFJS_CDN
  ).then((mod: unknown) => {
    const lib = mod as PdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    return lib;
  });
  return pdfjsPromise;
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
    options: Record<string, unknown>
  ) => Promise<TesseractWorker>;
}

let tesseractPromise: Promise<TesseractModule> | null = null;
function loadTesseract(): Promise<TesseractModule> {
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = import(
    /* webpackIgnore: true */ TESSERACT_CDN
  ).then((mod: any) => {
    // CDN ESM builds may export on default or as named exports
    return (mod.createWorker ? mod : mod.default) as TesseractModule;
  });
  return tesseractPromise;
}

async function runOcr(
  image: string | File,
  onProgress: (pct: number) => void
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
export function OcrUploaderWrapper({ onExtract }: { onExtract: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <OcrUploaderWithCallback
        onExtract={(t) => { setText(t); onExtract(t); }}
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
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjsLib = await loadPdfjs();
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const { createWorker } = await loadTesseract();

        let currentPage = 0;
        const worker = await createWorker("eng", 1, {
          workerPath: TESSERACT_WORKER_URL,
          corePath: TESSERACT_CORE_URL,
          langPath: TESSERACT_LANG_URL,
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgress(
                Math.round((100 * (currentPage + m.progress)) / pdf.numPages)
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
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          const { data } = await worker.recognize(canvas.toDataURL("image/png"));
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
      setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
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
      {error && (
        <div className="mt-2 text-red-500 text-sm">{error}</div>
      )}
    </div>
  );
}
