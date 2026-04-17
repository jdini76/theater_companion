import { NextRequest, NextResponse } from "next/server";
// Use the CJS entry directly so webpack/Next.js bundler doesn't accidentally
// pick up the ESM build, which has no default export and causes a 500 HTML
// response instead of JSON.
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer }) => {
    getText(): Promise<{ text: string; total: number }>;
  };
};

export const runtime = "nodejs";

// Max upload size: 10 MB
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 10 MB)" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(arrayBuffer);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text: string = result.text ?? "";
    const pageCount: number = result.total ?? 0;

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "No extractable text found in this PDF. It may use image-based or vector-outlined text. Try copying the text manually from the original document.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, pageCount });
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse PDF. Please try a different file." },
      { status: 500 },
    );
  }
}
