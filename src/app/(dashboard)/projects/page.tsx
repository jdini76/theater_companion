import { ProjectManager } from "@/components/projects/ProjectManager";

export const metadata = {
  title: "Productions | Theater Manager",
};

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-dark-base py-8">
      <ProjectManager />
    </div>
  );
}
