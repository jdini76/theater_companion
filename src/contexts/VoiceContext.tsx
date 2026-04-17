"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { VoiceConfig, CharacterRole, VoiceContextType } from "@/types/voice";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  createVoiceConfig as createVoiceConfigUtil,
  updateVoiceConfig as updateVoiceConfigUtil,
  createCharacter as createCharacterUtil,
  updateCharacter as updateCharacterUtil,
  validateCharacterName,
  validateVoiceConfig,
  characterNamesMatch,
} from "@/lib/voice";

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceConfigs, setVoiceConfigs] = useLocalStorage<VoiceConfig[]>(
    "theater_voice_configs",
    []
  );
  const [characters, setCharacters] = useLocalStorage<CharacterRole[]>(
    "theater_characters",
    []
  );
  const [currentCharacterId, setCurrentCharacterId] = useLocalStorage<string | null>(
    "theater_current_character_id",
    null
  );

  const createVoiceConfig = (
    characterName: string,
    voiceName: string,
    options?: { rate?: number; pitch?: number; volume?: number }
  ): VoiceConfig => {
    const newConfig = createVoiceConfigUtil(characterName, voiceName, options);
    setVoiceConfigs([...voiceConfigs, newConfig]);
    return newConfig;
  };

  const updateVoiceConfig = (
    id: string,
    updates: Partial<Omit<VoiceConfig, "id" | "characterName" | "createdAt">>
  ): void => {
    const config = voiceConfigs.find((c) => c.id === id);
    if (!config) {
      throw new Error(`Voice config with id ${id} not found`);
    }

    const validation = validateVoiceConfig(updates);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    const updated = updateVoiceConfigUtil(config, updates);
    setVoiceConfigs(voiceConfigs.map((c) => (c.id === id ? updated : c)));
  };

  const deleteVoiceConfig = (id: string): void => {
    const filtered = voiceConfigs.filter((c) => c.id !== id);
    setVoiceConfigs(filtered);
  };

  const getVoiceConfig = (id: string): VoiceConfig | null => {
    return voiceConfigs.find((c) => c.id === id) || null;
  };

  const getVoiceConfigByCharacter = (characterName: string): VoiceConfig | null => {
    const upper = characterName.trim().toUpperCase();
    // Exact match first
    const exact = voiceConfigs.find((c) => c.characterName.toUpperCase() === upper);
    if (exact) return exact;
    // Fuzzy: first-name / prefix match
    return voiceConfigs.find((c) => characterNamesMatch(c.characterName, characterName)) || null;
  };

  const createCharacter = (
    projectId: string,
    characterName: string,
    description?: string,
    actorName?: string
  ): CharacterRole => {
    const validation = validateCharacterName(characterName);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newCharacter = createCharacterUtil(
      projectId,
      characterName,
      description,
      actorName
    );

    // Auto-create default voice config
    const voiceConfig = createVoiceConfig(characterName, "Default");
    const characterWithVoice = { ...newCharacter, voiceConfigId: voiceConfig.id };

    setCharacters([...characters, characterWithVoice]);
    return characterWithVoice;
  };

  const updateCharacter = (
    id: string,
    updates: Partial<Omit<CharacterRole, "id" | "projectId" | "createdAt">>
  ): void => {
    const character = characters.find((c) => c.id === id);
    if (!character) {
      throw new Error(`Character with id ${id} not found`);
    }

    const updated = updateCharacterUtil(character, updates);
    setCharacters(characters.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCharacter = (id: string): void => {
    const character = characters.find((c) => c.id === id);
    if (!character) {
      throw new Error(`Character with id ${id} not found`);
    }

    // Delete associated voice config
    if (character.voiceConfigId) {
      deleteVoiceConfig(character.voiceConfigId);
    }

    const filtered = characters.filter((c) => c.id !== id);
    setCharacters(filtered);

    // Clear current character if deleted
    if (currentCharacterId === id) {
      setCurrentCharacterId(null);
    }
  };

  const getProjectCharacters = (projectId: string): CharacterRole[] => {
    return characters
      .filter((c) => c.projectId === projectId)
      .sort((a, b) =>
        a.characterName.localeCompare(b.characterName)
      );
  };

  const importCastCharacters = (
    projectId: string,
    names: string[],
  ): CharacterRole[] => {
    const existing = new Set(
      characters
        .filter((c) => c.projectId === projectId)
        .map((c) => c.characterName.toUpperCase()),
    );

    const newCharacters: CharacterRole[] = [];
    const newConfigs: VoiceConfig[] = [];

    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed || existing.has(trimmed.toUpperCase())) continue;
      existing.add(trimmed.toUpperCase());

      const character = createCharacterUtil(projectId, trimmed);
      const config = createVoiceConfigUtil(trimmed, "Default");
      newCharacters.push({ ...character, voiceConfigId: config.id });
      newConfigs.push(config);
    }

    if (newCharacters.length > 0) {
      setVoiceConfigs([...voiceConfigs, ...newConfigs]);
      setCharacters([...characters, ...newCharacters]);
    }

    return newCharacters;
  };

  const setCurrentCharacterById = (characterId: string): void => {
    const character = characters.find((c) => c.id === characterId);
    if (!character) {
      throw new Error(`Character with id ${characterId} not found`);
    }
    setCurrentCharacterId(characterId);
  };

  const getCurrentCharacter = (): CharacterRole | null => {
    if (!currentCharacterId) return null;
    return characters.find((c) => c.id === currentCharacterId) || null;
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceConfigs,
        characters,
        currentCharacterId,
        createVoiceConfig,
        updateVoiceConfig,
        deleteVoiceConfig,
        getVoiceConfig,
        getVoiceConfigByCharacter,
        createCharacter,
        updateCharacter,
        deleteCharacter,
        getProjectCharacters,
        importCastCharacters,
        setCurrentCharacter: setCurrentCharacterById,
        getCurrentCharacter,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextType {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
}
