# Theater Rehearsal Manager

A modern web platform for managing theater productions, rehearsals, cast members, and more.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Testing**: Vitest + React Testing Library
- **Package Manager**: npm

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Main app routes
│   │   ├── rehearsals/    # Rehearsal management
│   │   ├── cast/          # Cast member management
│   │   ├── schedule/      # Schedule & calendar
│   │   └── settings/      # Configuration
│   ├── api/               # API routes
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── common/            # Shared components (Header, Nav, etc.)
│   ├── rehearsals/        # Rehearsal-specific components
│   ├── cast/              # Cast-specific components
│   └── ui/                # Shadcn/ui primitives
├── hooks/                 # Custom React hooks
├── lib/
│   ├── utils.ts          # Utility functions
│   ├── api.ts            # API client functions
│   └── supabase.ts       # Supabase client setup
├── types/                 # TypeScript interfaces
├── constants/             # App constants
├── styles/                # Global styles
└── __tests__/             # Test files
```

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

```bash
npm run build
npm start
```

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

## Features Implemented

### ✅ Projects with Local Persistence

- Create, rename, delete, and select projects
- Projects saved to browser localStorage
- Project selector in header navigation
- Full project management page at `/projects`
- Automatic project selection on creation
- Smart deletion (auto-selects another project)
- Project validation and error handling

See [PROJECTS_GUIDE.md](./PROJECTS_GUIDE.md) for detailed usage.

## Development Guidelines

- **TypeScript**: Use strict mode - all files should be fully typed
- **Components**: Keep them small and focused on a single responsibility
- **Hooks**: Extract stateful logic into custom hooks in `/src/hooks`
- **Context**: Use React Context for global state (projects, auth, etc.)
- **API**: Centralize API calls in `/src/lib/api.ts` and `/src/lib/supabase.ts`
- **Styling**: Use Tailwind CSS classes; create reusable components with shadcn/ui
- **Testing**: Write tests for critical business logic and components

## Project Structure Highlights

```
src/
├── contexts/              # Global state (ProjectContext)
├── types/                 # TypeScript interfaces (Project types)
├── lib/
│   └── projects.ts       # Project business logic
├── hooks/
│   └── useLocalStorage.ts # Generic localStorage hook
├── components/
│   ├── projects/         # Project management components
│   ├── common/           # Shared components (Header with ProjectSelector)
│   └── ui/               # UI primitives (Button, etc.)
```

## Future Expansion

- User authentication and role management
- Advanced rehearsal scheduling
- Scene management and blocking notes
- Props and costume inventory system
- Production analytics and reporting
- Attendance tracking
- Cloud sync for projects (Supabase integration)
- Project templates and presets

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT
