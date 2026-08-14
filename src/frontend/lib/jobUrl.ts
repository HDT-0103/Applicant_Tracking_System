// --- Public job posting URLs --------------------------------------------------
// A shareable link looks like /careers/senior-ml-engineer-<uuid>.
// The trailing UUID is the only identifier that matters, so renaming a job
// never breaks a link an HR has already published.

const UUID_SUFFIX = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function slugifyJobTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Path only — safe to use during SSR. */
export function buildJobPath(id: string, title: string): string {
  const slug = slugifyJobTitle(title || "");
  return slug ? `/careers/${slug}-${id}` : `/careers/${id}`;
}

/** Absolute URL for copy-to-clipboard. Falls back to the path on the server. */
export function buildJobUrl(id: string, title: string): string {
  const path = buildJobPath(id, title);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

/** Extracts the job UUID from a slug. Returns null for legacy title-only slugs. */
export function parseJobId(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const match = UUID_SUFFIX.exec(decodeURIComponent(slug).trim());
  return match ? match[1].toLowerCase() : null;
}
