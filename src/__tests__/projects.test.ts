import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateProjectId,
  createProject,
  renameProject,
  validateProjectName,
  findProject,
  sortProjectsByUpdated,
} from "@/lib/projects";
import { Project } from "@/types/project";

describe("Project utilities", () => {
  describe("generateProjectId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateProjectId();
      const id2 = generateProjectId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^project_\d+_[a-z0-9]+$/);
    });
  });

  describe("createProject", () => {
    it("should create a project with required fields", () => {
      const project = createProject("My Project");
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("name", "My Project");
      expect(project).toHaveProperty("createdAt");
      expect(project).toHaveProperty("updatedAt");
    });

    it("should include optional description", () => {
      const project = createProject("My Project", "A test project");
      expect(project.description).toBe("A test project");
    });
  });

  describe("renameProject", () => {
    let project: Project;

    beforeEach(() => {
      project = createProject("Original Name");
    });

    it("should rename project and update timestamp", () => {
      const renamed = renameProject(project, "New Name");
      expect(renamed.name).toBe("New Name");
      expect(renamed.id).toBe(project.id);
      expect(new Date(renamed.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(project.updatedAt).getTime()
      );
    });
  });

  describe("validateProjectName", () => {
    it("should reject empty names", () => {
      const result = validateProjectName("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject names with only whitespace", () => {
      const result = validateProjectName("   ");
      expect(result.valid).toBe(false);
    });

    it("should reject names over 100 characters", () => {
      const longName = "a".repeat(101);
      const result = validateProjectName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100");
    });

    it("should accept valid names", () => {
      const result = validateProjectName("Valid Project Name");
      expect(result.valid).toBe(true);
    });
  });

  describe("findProject", () => {
    let projects: Project[];

    beforeEach(() => {
      projects = [
        createProject("Project 1"),
        createProject("Project 2"),
        createProject("Project 3"),
      ];
    });

    it("should find project by ID", () => {
      const found = findProject(projects, projects[1].id);
      expect(found).toBe(projects[1]);
    });

    it("should return null if project not found", () => {
      const found = findProject(projects, "nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("sortProjectsByUpdated", () => {
    it("should sort projects by updated date descending", async () => {
      const project1 = createProject("Project 1");
      
      // Simulate time passing
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      const project2 = createProject("Project 2");
      const projects = [project1, project2];
      
      const sorted = sortProjectsByUpdated(projects);
      expect(sorted[0].id).toBe(project2.id);
      expect(sorted[1].id).toBe(project1.id);
    });
  });
});
