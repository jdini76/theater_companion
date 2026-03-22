export interface Rehearsal {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CastMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  rehearsalId: string;
  sceneNumber: number;
  title: string;
  description?: string;
  castMembers: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: "admin" | "director" | "cast" | "crew";
  createdAt: string;
}
