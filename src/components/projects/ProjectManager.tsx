"use client";

import React, { useState } from "react";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectList } from "./ProjectList";
import { Button } from "@/components/ui/Button";

export function ProjectManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-light mb-2">Productions</h1>
            <p className="text-muted">Create and manage your theater productions</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Hide Form" : "+ Production"}
          </Button>
        </div>

        {showCreateForm && (
          <div className="card mb-8 border-accent-cyan border-2">
            <h2 className="text-2xl font-semibold text-light mb-6">
              Create a New Production
            </h2>
            <CreateProjectForm
              onSuccess={() => setShowCreateForm(false)}
            />
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
