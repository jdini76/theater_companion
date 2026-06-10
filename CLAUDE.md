# Theater Rehearsal Manager — Claude Instructions

## Release Notes (Welcome Modal)
Whenever you make a user-facing change (bug fix, new feature, UI/UX tweak, etc.), add a
bullet describing it to the `highlights` array of the current entry in `RELEASE_NOTES`
in `src/components/common/WelcomeModal.tsx`. This array drives the "What's New" tab of
the welcome popup shown to users (`RELEASE_NOTES[0]` is always the latest entry). Write
the bullet from the user's perspective (what changed for them), not as an internal
description of the code change. Skip this for purely internal changes (refactors, tests,
tooling, dependency bumps) that users would never notice.
- If the current top entry's `version` already matches `NEXT_PUBLIC_APP_VERSION`
  (`next.config.ts` / `package.json`), append your bullet to its `highlights` list.
- If you are also bumping `NEXT_PUBLIC_APP_VERSION` for this change, add a brand-new
  entry to the *front* of `RELEASE_NOTES` with the new version, a date, and your bullet —
  do not edit or remove older entries.

(This mirrors the same instruction in `.github/copilot-instructions.md` so both
assistants keep the What's New tab up to date.)
