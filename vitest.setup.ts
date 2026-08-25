import "@testing-library/jest-dom/vitest";

// `lib/supabase` throws at import time when NEXT_PUBLIC_* are missing, and
// vitest does not load .env. Components pull it in transitively through
// `lib/db`, so without these the whole render fails before a single assertion.
// Placeholder values: nothing here ever reaches the network.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-anon-key";
