"use client";

import Link from "next/link";
import { useProjects } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const { projects, getCurrentProject } = useProjects();
  const currentProject = getCurrentProject();

  return (
    <div className="min-h-screen bg-dark-base">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-light mb-4 flex items-center justify-center gap-3">
            🎭 Theater Rehearsal Manager
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            Manage your theater productions with ease. Create scenes, organize cast,
            and rehearse like a pro.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="card max-w-md mx-auto text-center py-12">
            <h2 className="text-2xl font-semibold text-light mb-4">Welcome!</h2>
            <p className="text-muted mb-8">
              Get started by creating your first theater project.
            </p>
            <Link href="/projects">
              <Button variant="primary" size="lg">
                Create First Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 max-w-2xl mx-auto">
            {currentProject ? (
              <div className="card">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-accent-cyan mb-2">
                    {currentProject.name}
                  </h2>
                  {currentProject.description && (
                    <p className="text-muted text-lg">{currentProject.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-dark-input rounded-lg p-4 border border-dark">
                    <div className="text-muted text-sm mb-1">Total Projects</div>
                    <div className="text-3xl font-bold text-accent-cyan">
                      {projects.length}
                    </div>
                  </div>
                  <div className="bg-dark-input rounded-lg p-4 border border-dark">
                    <div className="text-muted text-sm mb-1">Status</div>
                    <div className="text-lg font-semibold text-accent-green">Active</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/rehearsals">
                    <Button variant="primary">View Rehearsals</Button>
                  </Link>
                  <Link href="/cast">
                    <Button variant="success">Manage Cast</Button>
                  </Link>
                  <Link href="/projects">
                    <Button variant="outline">Switch Project</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-muted mb-4 text-lg">
                  You have {projects.length} project{projects.length !== 1 ? "s" : ""}, but none selected.
                </p>
                <Link href="/projects">
                  <Button variant="primary" size="lg">
                    Select a Project
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
