"use client";

import React, { useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/Button";
import type { ProductionType } from "@/types/project";

const PRODUCTION_TYPES: ProductionType[] = ["Play", "Musical", "Film"];

export function CreateProjectForm({ onSuccess }: { onSuccess?: () => void }) {
  const { createProject } = useProjects();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productionType, setProductionType] = useState<ProductionType>("Play");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      createProject(name, description, productionType);
      setName("");
      setDescription("");
      setProductionType("Play");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-light mb-1">
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Theater Project"
          className="w-full px-3 py-2 border border-dark bg-dark-input text-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-cyan placeholder-muted/50"
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-light mb-2">
          Production Type
        </label>
        <div className="flex gap-3">
          {PRODUCTION_TYPES.map((type) => (
            <label
              key={type}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                productionType === type
                  ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                  : "border-dark text-muted hover:border-muted hover:text-light"
              }`}
            >
              <input
                type="radio"
                name="productionType"
                value={type}
                checked={productionType === type}
                onChange={() => setProductionType(type)}
                className="sr-only"
                disabled={isLoading}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-light mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="w-full px-3 py-2 border border-dark bg-dark-input text-light rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-cyan placeholder-muted/50"
          rows={3}
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-3 bg-dark-panel border border-warn-amber text-warn-amber rounded-lg">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading || !name.trim()}
      >
        {isLoading ? "Creating..." : "Create Project"}
      </Button>
    </form>
  );
}
