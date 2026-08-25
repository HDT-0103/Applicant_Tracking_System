/**
 * Data access for screens that require a signed-in user.
 *
 * ## Why this module exists
 *
 * The app grew two independent ways of reading data:
 *
 *   1. `services/httpClient` — calls the backend API, carries a JWT, refreshes
 *      it silently, and signs the user out when the session truly dies.
 *   2. `lib/supabase` — queries PostgREST directly with the anon key, and knows
 *      nothing about sessions at all.
 *
 * Because the second path never checks the session, half the application kept
 * working after a session expired: the dashboard rendered fine while every
 * detail screen returned 401. The user saw an app that was signed in and
 * broken at the same time, with no way out but clearing site data.
 *
 * This module puts the direct-Supabase path under the SAME session lifecycle as
 * the API path. It does not replace PostgREST — rewriting every query as a REST
 * endpoint would be a large change for no user-visible gain — it makes the two
 * paths agree about who is signed in.
 *
 * ## What it does NOT cover
 *
 * The public careers page (`/careers`). Candidates applying through a shared
 * link have no account and never will, so those queries legitimately run as
 * anonymous and must keep working with no session. They use `lib/supabase`
 * directly, on purpose.
 */
import { supabase } from "./supabase";
import { resolveSessionState } from "./jwt";
import {
  getStoredAccessToken,
  getStoredRefreshToken,
  notifySessionExpired,
} from "../services/httpClient";

/**
 * A data-layer failure the UI can branch on.
 *
 * Mirrors `ApiError` from httpClient deliberately: a screen should not have to
 * care whether a given piece of data came from the API or from PostgREST in
 * order to tell "your session ended" apart from "that query failed".
 */
export class DataError extends Error {
  constructor(
    message: string,
    readonly kind: "session_expired" | "query_failed",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DataError";
  }

  get isSessionExpired(): boolean {
    return this.kind === "session_expired";
  }
}

/**
 * True when the stored tokens still represent a usable session.
 *
 * `refreshable` counts as signed in: the access token has expired but the
 * refresh token has not, and the next API call renews it. Treating that as
 * signed out would eject someone who simply left a tab open over lunch.
 */
export function hasLiveSession(): boolean {
  return (
    resolveSessionState(getStoredAccessToken(), getStoredRefreshToken()) !==
    "expired"
  );
}

/**
 * Returns the Supabase client, but only for a live session.
 *
 * This is the main entry point. Call sites change from
 *
 *     supabase.from('jobs_posting')…
 *     db().from('jobs_posting')…
 *
 * and keep whatever error handling they already had. Small diff, and every
 * authenticated query now passes the same session check.
 *
 * Throws `DataError` with `kind: "session_expired"` when the session is gone,
 * after signing the user out through the same path the API client uses.
 */
export function db() {
  if (!hasLiveSession()) {
    notifySessionExpired();
    throw new DataError(
      "Your session has expired. Please sign in again.",
      "session_expired",
    );
  }
  return supabase;
}

/**
 * Runs a query only if the session is alive, and reports failures uniformly.
 *
 * Checking before the query rather than reacting to the response matters:
 * PostgREST with an expired app session does not necessarily fail. The anon key
 * is still valid, so the request can succeed and return rows the user should no
 * longer be seeing. Verifying our own session first is what closes that gap.
 *
 * @param label short description used in the error message, e.g. "load candidates"
 */
export async function guarded<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  if (!hasLiveSession()) {
    // Same exit route as the API path: clear tokens, drop the user, redirect.
    notifySessionExpired();
    throw new DataError(
      "Your session has expired. Please sign in again.",
      "session_expired",
    );
  }

  const { data, error } = await run();

  if (error) {
    throw new DataError(`Could not ${label}: ${error.message}`, "query_failed", error);
  }

  // PostgREST returns `null` data with no error for an empty `.single()`.
  // Callers asking for a list should use a `.select()` that yields `[]`.
  return data as T;
}

/** The raw client, for building queries that `guarded` will run. */
export { supabase };
