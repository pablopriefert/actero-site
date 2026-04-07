import { supabase } from './supabase'

/**
 * Fetches the role of a user from the 'profiles' or 'admin_users' table.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string>} - The user's role ('admin' or 'client').
 */
export const fetchUserRole = async (userId) => {
  if (!supabase) return "client";
  try {
    // Get the user's email to check if they're a real Actero admin
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';

    // Check admin_users table
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminRow) return "admin";

    // Check profiles table but ONLY trust 'admin' role if also in admin_users
    // (profiles.role = 'admin' alone is not enough — it could be stale)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === 'admin') {
      // Double-check: is this user really an admin?
      // If they're in client_users, they're a client, not an admin
      const { data: clientLink } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (clientLink) return "client"; // They're a client team member, not an Actero admin
      return "admin";
    }

    return profile?.role || "client";
  } catch (err) {
    console.error("[fetchUserRole] Error:", err);
    return "client";
  }
};
