import Link from "next/link";
import { ProjectSelector } from "@/components/projects/ProjectSelector";
import { NAVIGATION_ITEMS } from "@/constants";

export function Header() {
  return (
    <header className="border-b border-dark bg-dark-panel sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-accent-cyan">
              🎭 Theater
            </Link>
          </div>

          <div className="flex items-center gap-4 flex-1">
            <ProjectSelector />

            <div className="flex space-x-1 ml-auto">
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
          </div>
        </div>
      </nav>
    </header>
  );
}
