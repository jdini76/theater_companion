import { useMemo } from "react";

export type DeviceType = "ios" | "android" | "desktop";

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS 13+ spoofs as Macintosh but exposes touch points
  const isIOS =
    /iPhone|iPod/.test(ua) ||
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useDeviceCapabilities() {
  const deviceType = useMemo(() => detectDevice(), []);
  const isMobile = deviceType === "ios" || deviceType === "android";
  return {
    deviceType,
    isMobile,
    canUploadAndParse: !isMobile,
    canUseKokoro: !isMobile,
  };
}
