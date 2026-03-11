import { supabase } from './supabase'

/**
 * Fetches the role of a user from the 'profiles' or 'admin_users' table.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string>} - The user's role ('admin' or 'client').
 */
export const fetchUserRole = async (userId) => {
  if (!supabase) return "client";
  try {
    // 1. Try profiles.role first
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!profileErr && profile && profile.role) {
      return profile.role; // 'admin' or 'client'
    }

    // 2. Fallback: check admin_users table
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    return adminRow ? "admin" : "client";
  } catch (err) {
    console.error("[fetchUserRole] Error:", err);
    return "client"; // Safe default
  }
};
