"use client";

import React, { useState } from "react";
import { Scene } from "@/types/scene";
import { Button } from "@/components/ui/Button";

interface SceneViewerProps {
  scene: Scene;
  onEdit?: () => void;
}

export function SceneViewer({ scene, onEdit }: SceneViewerProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyContent = () => {
    navigator.clipboard.writeText(scene.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([scene.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${scene.title.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="card space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-light">{scene.title}</h2>
          {scene.description && (
            <p className="text-muted mt-2">{scene.description}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm text-muted">
            <span>
              {scene.content.split("\n").length} lines
            </span>
            <span>
              ~{Math.ceil(scene.content.length / 5)} words
            </span>
            <span>
              Edited{" "}
              {new Date(scene.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleCopyContent}
            title="Copy content"
          >
            {isCopied ? "Copied!" : "Copy"}
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            title="Download as text file"
          >
            Download
          </Button>
          {onEdit && (
            <Button
              size="sm"
              variant="primary"
              onClick={onEdit}
              title="Edit scene"
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="bg-background border border-border rounded-lg p-6">
        <div className="text-light whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-96 overflow-y-auto">
          {scene.content}
        </div>
      </div>
    </div>
  );
}
