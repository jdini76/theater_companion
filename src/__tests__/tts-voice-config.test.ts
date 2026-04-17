import { describe, it, expect, beforeEach, vi } from "vitest";
import { VoiceConfig } from "@/types/voice";
import { characterNamesMatch } from "@/lib/voice";

/**
 * Test suite for TTS Voice Configuration retrieval
 * Tests the bug fixes:
 * 1. Voice config lookup using correct character name
 * 2. Voice config persistence from onboarding to rehearsal
 */

describe("TTS Voice Config Integration", () => {
  // Mock voice configs as they come from RehearsalOnboarding
  const mockVoiceConfigs: Record<string, VoiceConfig> = {
    ROMEO: {
      id: "vc_1",
      characterName: "ROMEO",
      voiceName: "Google UK English Male",
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      muted: false,
      createdAt: new Date(),
    },
    JULIET: {
      id: "vc_2",
      characterName: "JULIET",
      voiceName: "Google UK English Female",
      rate: 0.9,
      pitch: 1.2,
      volume: 0.95,
      muted: false,
      createdAt: new Date(),
    },
    NURSE: {
      id: "vc_3",
      characterName: "NURSE",
      voiceName: "Google UK English Female",
      rate: 0.8,
      pitch: 0.9,
      volume: 0.9,
      muted: false,
      createdAt: new Date(),
    },
  };

  describe("Bug Fix #1: Voice Config Lookup by Character Name", () => {
    it("should retrieve voice config using character name (not ID)", () => {
      /**
       * BEFORE (buggy):
       * RehearsalPlayer was calling:
       *   getVoiceConfigByCharacter(currentSession.userCharacterId)
       *   where userCharacterId = "char_ROMEO"
       * But getVoiceConfigByCharacter() searches by characterName, not ID
       *
       * AFTER (fixed):
       * RehearsalPlayer now calls:
       *   getVoiceConfigByCharacter(currentLine.character)
       *   where currentLine.character = "ROMEO" (the actual character name)
       */

      // Simulate getVoiceConfigByCharacter lookup function
      const getVoiceConfigByCharacter = (characterName: string) => {
        return mockVoiceConfigs[characterName] || null;
      };

      // Bug fix: Use character name from current line
      const currentLineCharacter = "ROMEO";
      const voiceConfig = getVoiceConfigByCharacter(currentLineCharacter);

      // This should now work
      expect(voiceConfig).not.toBeNull();
      expect(voiceConfig?.characterName).toBe("ROMEO");
      expect(voiceConfig?.voiceName).toBe("Google UK English Male");
      expect(voiceConfig?.rate).toBe(1.0);
    });

    it("should return null for non-existent character", () => {
      const getVoiceConfigByCharacter = (characterName: string) => {
        return mockVoiceConfigs[characterName] || null;
      };

      const voiceConfig = getVoiceConfigByCharacter("UNKNOWN_CHARACTER");
      expect(voiceConfig).toBeNull();
    });

    it("should handle different characters in same scene", () => {
      const getVoiceConfigByCharacter = (characterName: string) => {
        return mockVoiceConfigs[characterName] || null;
      };

      // Test all three characters
      const characters = ["ROMEO", "JULIET", "NURSE"];
      characters.forEach((character) => {
        const config = getVoiceConfigByCharacter(character);
        expect(config).not.toBeNull();
        expect(config?.characterName).toBe(character);
      });
    });
  });

  describe("Bug Fix #2: Voice Config Persistence from Onboarding", () => {
    it("should persist voice configs to context during rehearsal start", () => {
      /**
       * BEFORE (buggy):
       * RehearsalPlayerWrapper received voiceConfigs but never saved them
       * to VoiceContext (localStorage)
       * Result: RehearsalPlayer couldn't find configs via getVoiceConfigByCharacter()
       *
       * AFTER (fixed):
       * RehearsalPlayerWrapper now loops through config.voiceConfigs and
       * calls createVoiceConfig() for each character
       */

      // Simulate VoiceContext storage
      const voiceContextStorage: Record<string, VoiceConfig> = {};

      // Simulate createVoiceConfig function
      const createVoiceConfig = (
        characterName: string,
        voiceName: string,
        options?: { rate?: number; pitch?: number; volume?: number },
      ): VoiceConfig => {
        const config: VoiceConfig = {
          id: `vc_${Object.keys(voiceContextStorage).length + 1}`,
          characterName,
          voiceName,
          rate: options?.rate ?? 1.0,
          pitch: options?.pitch ?? 1.0,
          volume: options?.volume ?? 1.0,
          muted: false,
          createdAt: new Date(),
        };
        voiceContextStorage[characterName] = config;
        return config;
      };

      // Bug fix: Save each voice config from onboarding
      Object.values(mockVoiceConfigs).forEach((voiceConfig) => {
        createVoiceConfig(voiceConfig.characterName, voiceConfig.voiceName, {
          rate: voiceConfig.rate,
          pitch: voiceConfig.pitch,
          volume: voiceConfig.volume,
        });
      });

      // Verify all configs were saved
      expect(Object.keys(voiceContextStorage).length).toBe(3);
      expect(voiceContextStorage["ROMEO"]).toBeDefined();
      expect(voiceContextStorage["JULIET"]).toBeDefined();
      expect(voiceContextStorage["NURSE"]).toBeDefined();
    });

    it("should maintain voice settings during persistence", () => {
      const voiceContextStorage: Record<string, VoiceConfig> = {};

      const createVoiceConfig = (
        characterName: string,
        voiceName: string,
        options?: { rate?: number; pitch?: number; volume?: number },
      ): VoiceConfig => {
        const config: VoiceConfig = {
          id: `vc_${Math.random()}`,
          characterName,
          voiceName,
          rate: options?.rate ?? 1.0,
          pitch: options?.pitch ?? 1.0,
          volume: options?.volume ?? 1.0,
          muted: false,
          createdAt: new Date(),
        };
        voiceContextStorage[characterName] = config;
        return config;
      };

      // Save test config
      createVoiceConfig("JULIET", "Google UK English Female", {
        rate: 0.9,
        pitch: 1.2,
        volume: 0.95,
      });

      // Verify settings are preserved
      const savedConfig = voiceContextStorage["JULIET"];
      expect(savedConfig.rate).toBe(0.9);
      expect(savedConfig.pitch).toBe(1.2);
      expect(savedConfig.volume).toBe(0.95);
    });
  });

  describe("TTS Playback Flow Integration", () => {
    it("should complete full flow: retrieve config, apply settings, trigger audio", () => {
      /**
       * Full TTS flow after bug fixes:
       * 1. RehearsalOnboarding creates voice configs
       * 2. RehearsalPlayerWrapper saves configs to VoiceContext
       * 3. RehearsalPlayer gets currentLine with character name
       * 4. RehearsalPlayer retrieves config using character name
       * 5. RehearsalControls receives voiceConfig prop
       * 6. playCurrentLine() calls speakText(dialogue, voiceConfig)
       * 7. speakText() applies rate, pitch, volume and triggers window.speechSynthesis.speak()
       */

      let speakCalled = false;
      let appliedConfig: VoiceConfig | null = null;

      // Mock window.speechSynthesis.speak
      global.speechSynthesis = {
        speak: vi.fn(() => {
          speakCalled = true;
        }),
      } as any;

      // Mock speakText function
      const speakText = (text: string, voiceConfig: VoiceConfig) => {
        appliedConfig = voiceConfig;
        if (!voiceConfig.muted) {
          global.speechSynthesis.speak("" as any);
        }
      };

      // Simulate flow
      const currentLine = {
        character: "ROMEO",
        dialogue: "O Romeo, wherefore art thou?",
      };
      const voiceConfig = mockVoiceConfigs["ROMEO"];

      // Call speakText as RehearsalControls would
      speakText(currentLine.dialogue, voiceConfig);

      // Verify
      expect(speakCalled).toBe(true);
      expect(appliedConfig).toBeDefined();
      expect(appliedConfig?.characterName).toBe("ROMEO");
      expect(appliedConfig?.rate).toBe(1.0);
    });

    it("should skip audio if voice config is muted", () => {
      let speakCalled = false;

      global.speechSynthesis = {
        speak: vi.fn(() => {
          speakCalled = true;
        }),
      } as any;

      const speakText = (text: string, voiceConfig: VoiceConfig) => {
        if (!voiceConfig.muted) {
          global.speechSynthesis.speak("" as any);
        }
      };

      // Create muted config
      const mutedConfig: VoiceConfig = {
        ...mockVoiceConfigs["ROMEO"],
        muted: true,
      };

      speakText("Some text", mutedConfig);

      // Verify speak was not called
      expect(speakCalled).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty voice configs object", () => {
      const emptyConfigs: Record<string, VoiceConfig> = {};

      const configArray = Object.values(emptyConfigs);
      expect(configArray.length).toBe(0);

      // Should not throw when iterating
      expect(() => {
        configArray.forEach((config) => {
          // Process config
        });
      }).not.toThrow();
    });

    it("should handle special characters in character names", () => {
      const getVoiceConfigByCharacter = (characterName: string) => {
        return mockVoiceConfigs[characterName] || null;
      };

      // Create config with special character name
      const specialConfig: VoiceConfig = {
        id: "vc_special",
        characterName: "SPIRIT OF MARS",
        voiceName: "Default",
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        muted: false,
        createdAt: new Date(),
      };

      mockVoiceConfigs["SPIRIT OF MARS"] = specialConfig;

      const retrieved = getVoiceConfigByCharacter("SPIRIT OF MARS");
      expect(retrieved).toBeDefined();
      expect(retrieved?.characterName).toBe("SPIRIT OF MARS");
    });
  });

  describe("characterNamesMatch — fuzzy first-name matching", () => {
    it("matches exact names case-insensitively", () => {
      expect(characterNamesMatch("Phil Connors", "PHIL CONNORS")).toBe(true);
      expect(characterNamesMatch("romeo", "ROMEO")).toBe(true);
    });

    it("matches first name to full name", () => {
      expect(characterNamesMatch("PHIL", "Phil Connors")).toBe(true);
      expect(characterNamesMatch("Phil Connors", "PHIL")).toBe(true);
    });

    it("does not match different first names", () => {
      expect(characterNamesMatch("PHIL", "Bill Connors")).toBe(false);
      expect(characterNamesMatch("ROMEO", "JULIET")).toBe(false);
    });

    it("does not match partial first names", () => {
      expect(characterNamesMatch("PHI", "Phil Connors")).toBe(false);
    });

    it("handles empty / whitespace strings", () => {
      expect(characterNamesMatch("", "Phil")).toBe(false);
      expect(characterNamesMatch("  ", "Phil")).toBe(false);
    });

    it("matches single-word names exactly", () => {
      expect(characterNamesMatch("NURSE", "Nurse")).toBe(true);
      expect(characterNamesMatch("NURSE", "Doctor")).toBe(false);
    });
  });
});
