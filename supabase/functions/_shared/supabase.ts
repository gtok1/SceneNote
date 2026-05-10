import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createUserClient(jwt: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is missing");
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function requireUser(req: Request): Promise<{ id: string; jwt: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const jwt = authHeader.replace("Bearer ", "");
  const userClient = createUserClient(jwt);
  const {
    data: { user },
    error
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  return { id: user.id, jwt };
}
