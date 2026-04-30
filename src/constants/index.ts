export const APP_NAME = "Theater Rehearsal Manager";
export const APP_VERSION = "0.1.0";

export const ROLES = ["admin", "director", "cast", "crew"] as const;

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/rehearse", label: "Rehearse" },
  { href: "/about", label: "About" },
];
