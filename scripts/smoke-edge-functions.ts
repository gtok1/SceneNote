/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { SearchContentResponse } from "../src/types/content";
import type { Database } from "../src/types/database";

loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseUrl = readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("SUPABASE_URL");
const supabaseAnonKey = readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("SUPABASE_ANON_KEY");
const testEmail = readEnv("SCENENOTE_TEST_EMAIL");
const testPassword = readEnv("SCENENOTE_TEST_PASSWORD");
const query = process.argv[2] ?? "Inception";
const mediaType = process.argv[3] ?? "movie";

if (!supabaseUrl || !supabaseAnonKey) {
  fail("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.");
}

if (!testEmail || !testPassword) {
  fail("SCENENOTE_TEST_EMAIL and SCENENOTE_TEST_PASSWORD are required for authenticated smoke tests.");
}

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
  } finally {
    await supabase.auth.signOut();
  }
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
