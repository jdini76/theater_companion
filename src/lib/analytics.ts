import posthog from "posthog-js";

export function capture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}
