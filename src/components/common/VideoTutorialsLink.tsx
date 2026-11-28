import { ExternalLink } from "lucide-react";

export function VideoTutorialsLink() {
  return (
    <a
      href="https://www.youtube.com/channel/UC8Lm0PBMryxmrNxTd3TYLhQ"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-cyan hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-cyan"
    >
      Video tutorials
      <ExternalLink aria-hidden="true" size={14} />
      <span className="sr-only"> on YouTube (opens in a new tab)</span>
    </a>
  );
}
