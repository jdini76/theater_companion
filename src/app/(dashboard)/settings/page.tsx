import { SettingsContent } from "@/components/settings/SettingsContent";

export const metadata = {
  title: "Settings | Theater Manager",
};

export default function SettingsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-light">Settings</h1>
      <SettingsContent />
    </main>
  );
}
