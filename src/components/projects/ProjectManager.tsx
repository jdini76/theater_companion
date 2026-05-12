"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectList } from "./ProjectList";
import { Button } from "@/components/ui/Button";
import { loadSampleProduction } from "@/lib/data-export";

export function ProjectManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sampleStatus, setSampleStatus] = useState<string | null>(null);

  const handleLoadSample = async () => {
    const result = await loadSampleProduction();
    if (result === "already-exists") {
      setSampleStatus("Sample Production already exists in your library.");
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-light mb-2">Productions</h1>
            <p className="text-muted">
              Create and manage your theater productions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings?tab=data"
              className="px-3 py-2 text-sm border border-border text-muted font-medium rounded-lg hover:border-accent-cyan hover:text-light transition-colors"
            >
              Import Data
            </Link>
            <button
              onClick={handleLoadSample}
              className="px-3 py-2 text-sm border border-border text-muted font-medium rounded-lg hover:border-accent-cyan hover:text-light transition-colors"
              title="Load the built-in sample production"
            >
              Load Sample
            </button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? "Hide Form" : "+ Production"}
            </Button>
          </div>
        </div>

        {sampleStatus && (
          <p className="text-sm text-muted mb-4">{sampleStatus}</p>
        )}

        {showCreateForm && (
          <div className="card mb-8 border-accent-cyan border-2">
            <h2 className="text-2xl font-semibold text-light mb-6">
              Create a New Production
            </h2>
            <CreateProjectForm onSuccess={() => setShowCreateForm(false)} />
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-2xl font-semibold text-light mb-6">
          Your Productions
        </h2>
        <ProjectList />
      </div>
    </div>
  );
}
