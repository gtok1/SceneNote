import { corsHeaders, json, jsonError } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  let userId: string;
  try {
    userId = (await requireUser(req)).id;
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    return jsonError(
      500,
      "CONFIG_ERROR",
      error instanceof Error ? error.message : "Supabase service role configuration is missing"
    );
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    const message = error.message || "Failed to delete account";
    const normalizedMessage = message.toLowerCase();
    const status = normalizedMessage.includes("not found") ? 404 : 500;
    const code = status === 404 ? "USER_NOT_FOUND" : "DELETE_ACCOUNT_FAILED";

    return jsonError(status, code, message, {
      retryable: status !== 404
    });
  }

  return json({ success: true });
});
