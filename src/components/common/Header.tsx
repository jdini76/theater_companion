import Link from "next/link";
import { ProjectSelector } from "@/components/projects/ProjectSelector";
import { NAVIGATION_ITEMS } from "@/constants";

export function Header() {
  return (
    <header className="border-b border-dark bg-dark-panel sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-6">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-accent-cyan">
              🎭 Theater
            </Link>
          </div>

          <div className="flex space-x-1">
            {NAVIGATION_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted hover:text-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ProjectSelector />
            <Link
              href="/projects"
              className="text-muted hover:text-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              List
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
