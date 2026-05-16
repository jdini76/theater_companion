import { NextRequest, NextResponse } from "next/server";

// Server-side TTS proxy — keeps API keys out of the browser.
// Forwards OpenAI-compatible /v1/audio/speech requests to the configured
// provider (defaults to OpenRouter).

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "TTS not configured — OPENROUTER_API_KEY missing from server environment.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiBase = (process.env.OPENROUTER_API_URL ?? "https://openrouter.ai")
    .replace(/\/+$/, "")
    .replace(/^(https?:\/\/)api\.openrouter\.ai/, "$1openrouter.ai");
  const endpoint = `${apiBase}/api/v1/audio/speech`;
  const model =
    (body.model as string | undefined) ??
    process.env.OPENROUTER_MODEL ??
    "openai/tts-1";

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Theater Companion",
      },
      body: JSON.stringify({
        model,
        input: (body.input as string | undefined) ?? "",
        voice: (body.voice as string | undefined) ?? "nova",
        speed: (body.speed as number | undefined) ?? 1.0,
        response_format: (body.response_format as string | undefined) ?? "mp3",
      }),
    });
  } catch (err) {
    console.error("[/api/tts] fetch failed:", err);
    return NextResponse.json(
      { error: `Failed to reach TTS provider: ${String(err)}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error(`[/api/tts] upstream ${upstream.status}:`, errText);
    return NextResponse.json({ error: errText }, { status: upstream.status });
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
