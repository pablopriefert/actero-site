import { supabase } from './supabase'

/**
 * Determines if a user is an Actero platform admin or a regular client.
 * Admin = in admin_users table OR profiles.role = 'admin'
 * Client roles (owner, manager, operational, support, finance) are in client_users table
 * and do NOT make someone an Actero admin.
 */
export const fetchUserRole = async (userId) => {
  if (!supabase) return "client";
  try {
    // 1. Check admin_users table (definitive source of truth)
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminRow) return "admin";

    // 2. Check profiles.role as fallback
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === 'admin') return "admin";

    // 3. Everyone else is a client (their specific role is in client_users)
    return "client";
  } catch (err) {
    console.error("[fetchUserRole] Error:", err);
    return "client";
  }
};
