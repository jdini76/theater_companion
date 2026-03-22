import { supabase } from "./supabase";

export async function fetchRehearsal(id: string) {
  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchRehearsals() {
  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .order("date", { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchCastMembers() {
  const { data, error } = await supabase
    .from("cast_members")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}
