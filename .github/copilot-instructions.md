# Theater Rehearsal Web Application - Copilot Instructions

## Project Overview
Next.js theater rehearsal management platform with TypeScript, Tailwind CSS, Shadcn/ui, Supabase, and Vitest testing.

## Tech Stack
- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Testing**: Vitest + React Testing Library
- **Package Manager**: npm

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth-related routes
│   ├── (dashboard)/       # Main app routes
│   ├── api/               # API routes
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── common/            # Shared UI components
│   ├── rehearsals/        # Feature-specific components
│   ├── cast/
│   └── ui/                # Shadcn/ui primitives
├── hooks/                 # Custom React hooks
├── lib/
│   ├── utils.ts
│   ├── api.ts             # API client utilities
│   └── supabase.ts        # Supabase client
├── types/                 # TypeScript interfaces
├── constants/             # App constants
├── styles/                # Global styles
└── __tests__/             # Test files
```

## Development Guidelines
- Use TypeScript strictly for all components and utilities
- Create reusable components in the appropriate feature folder
- Keep API logic centralized in `lib/api.ts` and `lib/supabase.ts`
- Use custom hooks for stateful component logic
- Write tests for critical business logic and components
- Follow Tailwind CSS conventions for styling

## Key Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run Vitest test suite
- `npm run lint` - Run ESLint

## Release Notes (Welcome Modal)
Whenever you make a user-facing change (bug fix, new feature, UI/UX tweak, etc.), add a
bullet describing it to the `highlights` array of the current entry in `RELEASE_NOTES`
in `src/components/common/WelcomeModal.tsx`. This array drives the "What's New" tab of
the welcome popup shown to users (see `RELEASE_NOTES[0]`, which is always the latest
entry). Write the bullet from the user's perspective (what changed for them), not as an
internal description of the code change. Skip this for purely internal changes (refactors,
tests, tooling, dependency bumps) that users would never notice.
- If the current top entry's `version` already matches `NEXT_PUBLIC_APP_VERSION`
  (`next.config.ts` / `package.json`), append your bullet to its `highlights` list.
- If you are also bumping `NEXT_PUBLIC_APP_VERSION` for this change, add a brand-new
  entry to the *front* of `RELEASE_NOTES` with the new version, a date, and your bullet —
  do not edit or remove older entries.

## Features to Expand
- User authentication and role management
- Rehearsal scheduling and management
- Cast member management
- Scene tracking and notes
- Props and costume inventory
- Analytics and reporting
