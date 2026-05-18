export type LineOverride =
  | { kind: "dialogue"; char: string }
  | { kind: "header"; char: string }
  | { kind: "multi-header"; chars: string[] }
  | { kind: "stage-direction" }
  | { kind: "group"; mode?: "dialogue" | "header" }
  | { kind: "song-title"; text: string };
