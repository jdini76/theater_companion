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

## Features to Expand
- User authentication and role management
- Rehearsal scheduling and management
- Cast member management
- Scene tracking and notes
- Props and costume inventory
- Analytics and reporting
