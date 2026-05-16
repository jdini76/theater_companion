import { useState, useEffect, useCallback } from "react";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

function readVoices(): VoiceOption[] {
  if (typeof window === "undefined") return [];
  const raw = window.speechSynthesis?.getVoices() ?? [];
  return raw.map((v) => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI }));
}

/**
 * Returns browser speech-synthesis voices and a `triggerLoad` callback.
 *
 * On desktop/Android the voices populate automatically via voiceschanged.
 * On iOS Safari, getVoices() returns [] until speechSynthesis.speak() has been
 * called from a synchronous user-gesture handler.  Call `triggerLoad()` directly
 * from a button onClick to fire the silent primer and unblock the voice list.
 */
export function useVoiceList(): { voices: VoiceOption[]; triggerLoad: () => void } {
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  const snapshot = useCallback(() => {
    const list = readVoices();
    if (list.length > 0) setVoices(list);
  }, []);

  // triggerLoad: call this from a button onClick on iOS.
  // speak() must be in the synchronous call stack of a user gesture.
  const triggerLoad = useCallback(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 10;
      synth.speak(u);
      setTimeout(() => {
        synth.cancel();
        snapshot();
        setTimeout(snapshot, 300);
      }, 50);
    } catch {
      snapshot();
    }
  }, [snapshot]);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;

    synth.addEventListener?.("voiceschanged", snapshot);
    synth.onvoiceschanged = snapshot;

    // Works immediately on desktop; on iOS this may return [] until triggerLoad
    snapshot();
    const timers = [setTimeout(snapshot, 100), setTimeout(snapshot, 800)];

    return () => {
      timers.forEach(clearTimeout);
      synth.removeEventListener?.("voiceschanged", snapshot);
    };
  }, [snapshot]);

  return { voices, triggerLoad };
}
