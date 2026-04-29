"use client";

import React, { useEffect } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { VoiceControlPanel } from "@/components/cast/VoiceControlPanel";
import { useRouter } from "next/navigation";

export default function CastPage() {
  const { currentProjectId, getCurrentProject } = useProjects();
  const router = useRouter();

  useEffect(() => {
    if (!currentProjectId) {
      router.push("/projects");
    }
  }, [currentProjectId, router]);

  const currentProject = getCurrentProject();

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-dark-base py-8">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center py-12">
            <h1 className="text-2xl font-bold text-light mb-4">
              No Project Selected
            </h1>
            <p className="text-muted mb-6">
              Select a project first to manage cast and voices.
            </p>
            <button
              onClick={() => router.push("/projects")}
              className="px-6 py-2 bg-accent-cyan text-dark-base rounded font-semibold hover:opacity-90 transition-opacity"
            >
              Go to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-base py-8 px-0">
      <VoiceControlPanel projectId={currentProject.id} />
    </div>
  );
}
