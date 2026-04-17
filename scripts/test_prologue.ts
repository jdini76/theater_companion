import {
  parseScenes,
  detectSceneBreaks,
  cleanPdfArtifacts,
  createScenesFromInput,
} from "../src/lib/scenes";

// Test with various scene heading formats after prologue
const tests = [
  // Musical format with #N - Title
  {
    name: "Musical #N format",
    text: `Prologue: Miami International Airport
FRANK: Hello.
AGENT: Hi.

#1 - Live in Living Color
FRANK: Watch this.

#2 - The Pinstripes Are All That They See
CARL: Stop right there.`,
  },

  // Scene N format
  {
    name: "Scene N format",
    text: `Prologue: Miami International Airport
FRANK: Hello.

Scene 1: The Classroom
TEACHER: Pay attention.

Scene 2: The Bank
FRANK: Cash this.`,
  },

  // ACT format
  {
    name: "ACT format",
    text: `Prologue: Miami International Airport
FRANK: Hello.

ACT 1
TEACHER: Pay attention.

ACT 1, Scene 2
FRANK: Cash this.`,
  },

  // Prologue then Epilogue
  {
    name: "Prologue + Epilogue",
    text: `Prologue: Beginning
FRANK: Start of story.

Scene 1: Middle
BOB: Something happens.

Epilogue: The End
FRANK: That's all folks.`,
  },

  // Prologue with no colon
  {
    name: "Bare PROLOGUE",
    text: `PROLOGUE
FRANK: Hello.

SCENE 1
TEACHER: Pay attention.

SCENE 2
FRANK: Cash this.`,
  },
];

for (const t of tests) {
  console.log(`\n=== ${t.name} ===`);
  const scenes = parseScenes(t.text, { mode: "auto" });
  console.log(scenes.map((s) => s.title));
}
