/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SearchContentResponse } from "../src/types/content";
import type { PopularRecommendationsResponse } from "../src/services/popularRecommendations";
import type { Database } from "../src/types/database";

loadEnvFile(".env");
loadEnvFile(".env.local");

type DynamicSupabaseClient = SupabaseClient<any, "public", "public", any, any>;

const supabaseUrl =
  readEnv("EXPO_PUBLIC_SUPABASE_URL") ??
  readEnv("SUPABASE_URL") ??
  fail("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.");
const supabaseAnonKey =
  readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
  readEnv("SUPABASE_ANON_KEY") ??
  fail("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.");
const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const testEmail =
  readEnv("SCENENOTE_TEST_EMAIL") ??
  fail("SCENENOTE_TEST_EMAIL and SCENENOTE_TEST_PASSWORD are required for authenticated smoke tests.");
const testPassword =
  readEnv("SCENENOTE_TEST_PASSWORD") ??
  fail("SCENENOTE_TEST_EMAIL and SCENENOTE_TEST_PASSWORD are required for authenticated smoke tests.");
const query = process.argv[2] ?? "Inception";
const mediaType = process.argv[3] ?? "movie";

if (!["all", "anime", "drama", "movie"].includes(mediaType)) {
  fail("media_type must be one of: all, anime, drama, movie.");
}

const smokeTestEmail = testEmail;
const smokeTestPassword = testPassword;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

void main();

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: smokeTestEmail,
    password: smokeTestPassword
  });

  if (signInError) {
    fail(`Sign-in failed: ${signInError.message}`);
  }

  try {
    const { data, error } = await supabase.functions.invoke<SearchContentResponse>("search-content", {
      body: {
        query,
        media_type: mediaType
      }
    });

    if (error) {
      fail(`search-content failed: ${error.message}`);
    }

    if (!data) {
      fail("search-content returned an empty response.");
    }

    console.log("search-content smoke test passed");
    console.log(`query: ${data.query}`);
    console.log(`sources: ${data.sources.join(", ") || "(none)"}`);
    console.log(`failedSources: ${data.failedSources.join(", ") || "(none)"}`);
    console.log(`results: ${data.results.length}`);
    console.log(`firstResult: ${data.results[0]?.title_primary ?? "(none)"}`);

    const { data: recommendations, error: recommendationsError } =
      await supabase.functions.invoke<PopularRecommendationsResponse>("popular-recommendations");

    if (recommendationsError) {
      fail(`popular-recommendations failed: ${recommendationsError.message}`);
    }

    if (!recommendations) {
      fail("popular-recommendations returned an empty response.");
    }

    console.log("popular-recommendations smoke test passed");
    console.log(`dramaRecommendations: ${recommendations.categories.drama.length}`);
    console.log(`animeRecommendations: ${recommendations.categories.anime.length}`);
    console.log(`recommendationFailedSources: ${recommendations.failedSources.join(", ") || "(none)"}`);

    if (supabaseServiceRoleKey && shouldRunDeleteAccountSmoke(supabaseUrl)) {
      await runDeleteAccountSmoke(supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey);
    } else {
      console.log(
        "delete-account smoke test skipped (requires local Supabase or SCENENOTE_DELETE_ACCOUNT_SMOKE=1 plus SUPABASE_SERVICE_ROLE_KEY)."
      );
    }
  } finally {
    await supabase.auth.signOut();
  }
}

async function runDeleteAccountSmoke(
  supabaseUrl: string,
  supabaseAnonKey: string,
  serviceRoleKey: string
) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) as DynamicSupabaseClient;
  const testClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `delete-account-smoke-${suffix}@example.com`;
  const password = `SceneNote-delete-smoke-${suffix}!A1`;
  let userId: string | undefined;
  let contentId: string | undefined;

  try {
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createUserError || !createdUser.user) {
      fail(`delete-account smoke user creation failed: ${createUserError?.message ?? "missing user"}`);
    }

    userId = createdUser.user.id;
    const seeded = await seedDeleteAccountUserData(admin, userId, suffix);
    contentId = seeded.contentId;

    const { error: signInError } = await testClient.auth.signInWithPassword({ email, password });
    if (signInError) fail(`delete-account smoke sign-in failed: ${signInError.message}`);

    const { data: deleteResponse, error: deleteError } =
      await testClient.functions.invoke<{ success: boolean }>("delete-account");

    if (deleteError) fail(`delete-account failed: ${deleteError.message}`);
    if (!deleteResponse?.success) fail("delete-account returned an empty or unsuccessful response.");

    await assertAuthUserDeleted(admin, userId);
    await assertUserRowsDeleted(admin, userId, seeded.pinId);
    await assertContentMetadataStillExists(admin, seeded.contentId);

    const retry = await testClient.functions.invoke<{ success: boolean }>("delete-account");
    if (!retry.error) fail("delete-account retry with deleted JWT unexpectedly succeeded.");

    const retryStatus = getFunctionErrorStatus(retry.error);
    if (retryStatus && retryStatus >= 500) {
      fail(`delete-account retry returned server error status ${retryStatus}.`);
    }

    const afterDelete = await testClient.functions.invoke("create-library-share", {
      body: {
        title: "Deleted account smoke share",
        content_ids: [seeded.contentId]
      }
    });
    if (!afterDelete.error) fail("deleted account JWT unexpectedly invoked an authenticated function.");

    const afterDeleteStatus = getFunctionErrorStatus(afterDelete.error);
    if (afterDeleteStatus && afterDeleteStatus >= 500) {
      fail(`deleted account JWT check returned server error status ${afterDeleteStatus}.`);
    }

    console.log("delete-account smoke test passed");
    console.log(`deleteAccountSmokeUser: ${email}`);
  } finally {
    await testClient.auth.signOut({ scope: "local" });
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (contentId) await admin.from("contents").delete().eq("id", contentId);
  }
}

async function seedDeleteAccountUserData(
  admin: DynamicSupabaseClient,
  userId: string,
  suffix: string
) {
  const contentId = await insertReturningId(admin, "contents", {
    content_type: "anime",
    source_api: "manual",
    source_id: `delete-account-smoke-${suffix}`,
    title_primary: "Delete account smoke content",
    title_original: null,
    poster_url: null,
    overview: null,
    air_year: 2026
  });
  const seasonId = await insertReturningId(admin, "seasons", {
    content_id: contentId,
    season_number: 1,
    title: "Smoke season",
    episode_count: 1,
    air_year: 2026
  });
  const episodeId = await insertReturningId(admin, "episodes", {
    season_id: seasonId,
    content_id: contentId,
    episode_number: 1,
    title: "Smoke episode",
    duration_seconds: 1200
  });
  const tagId = await insertReturningId(admin, "tags", {
    user_id: userId,
    name: `탈퇴스모크-${suffix.slice(-4)}`
  });
  const pinId = await insertReturningId(admin, "timeline_pins", {
    user_id: userId,
    content_id: contentId,
    episode_id: episodeId,
    timestamp_seconds: 42,
    display_time_label: "00:42",
    memo: "delete account smoke pin",
    emotion: "moved",
    is_spoiler: false
  });

  await insertNoReturn(admin, "timeline_pin_tags", { pin_id: pinId, tag_id: tagId });
  await insertNoReturn(admin, "user_library_items", {
    user_id: userId,
    content_id: contentId,
    status: "wishlist",
    status_flags: ["wishlist"],
    watch_count: 0
  });
  await insertNoReturn(admin, "user_episode_progress", {
    user_id: userId,
    episode_id: episodeId,
    content_id: contentId
  });
  await insertNoReturn(admin, "reviews", {
    user_id: userId,
    content_id: contentId,
    rating: 8,
    body: "delete account smoke review",
    one_line_review: "smoke review",
    is_spoiler: false
  });
  await insertNoReturn(admin, "favorite_people", {
    user_id: userId,
    source: "tmdb",
    external_id: `delete-account-smoke-${suffix}`,
    category: "actor",
    name: "Delete Account Smoke Person",
    known_for: []
  });
  await insertNoReturn(admin, "library_shares", {
    owner_user_id: userId,
    title: "Delete account smoke share",
    filters: {},
    content_ids: [contentId],
    item_count: 1
  });

  return { contentId, pinId };
}

async function insertReturningId(
  admin: DynamicSupabaseClient,
  table: string,
  values: Record<string, unknown>
): Promise<string> {
  const { data, error } = await admin.from(table).insert(values).select("id").single();
  if (error || !data?.id) fail(`Failed to seed ${table}: ${error?.message ?? "missing id"}`);
  return String(data.id);
}

async function insertNoReturn(
  admin: DynamicSupabaseClient,
  table: string,
  values: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from(table).insert(values);
  if (error) fail(`Failed to seed ${table}: ${error.message}`);
}

async function assertAuthUserDeleted(admin: DynamicSupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (!error && data.user) fail("delete-account left auth.users row behind.");
}

async function assertUserRowsDeleted(
  admin: DynamicSupabaseClient,
  userId: string,
  pinId: string
) {
  const userScopedChecks = [
    ["profiles", "id"],
    ["user_library_items", "user_id"],
    ["user_episode_progress", "user_id"],
    ["reviews", "user_id"],
    ["tags", "user_id"],
    ["timeline_pins", "user_id"],
    ["favorite_people", "user_id"],
    ["library_shares", "owner_user_id"]
  ] as const;

  for (const [table, column] of userScopedChecks) {
    const count = await countRows(admin, table, column, userId);
    if (count > 0) fail(`delete-account left ${count} row(s) in ${table}.`);
  }

  const pinTagCount = await countRows(admin, "timeline_pin_tags", "pin_id", pinId);
  if (pinTagCount > 0) fail(`delete-account left ${pinTagCount} row(s) in timeline_pin_tags.`);
}

async function assertContentMetadataStillExists(
  admin: DynamicSupabaseClient,
  contentId: string
) {
  const { data, error } = await admin.from("contents").select("id").eq("id", contentId).maybeSingle();
  if (error || !data) fail(`content metadata was unexpectedly deleted: ${error?.message ?? "missing content"}`);
}

async function countRows(
  admin: DynamicSupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);

  if (error) fail(`Failed to count ${table}: ${error.message}`);
  return count ?? 0;
}

function shouldRunDeleteAccountSmoke(supabaseUrl: string) {
  if (readEnv("SCENENOTE_DELETE_ACCOUNT_SMOKE") === "1") return true;
  return isLocalSupabaseUrl(supabaseUrl);
}

function isLocalSupabaseUrl(value: string) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function getFunctionErrorStatus(error: unknown) {
  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context.status : undefined;
}

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (process.env[key]) continue;

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value: string) {
  const first = value[0];
  const last = value[value.length - 1];

  if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function readEnv(key: string) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
