// --- Route access rules -------------------------------------------------------
// Two separate ideas that used to be one flag:
//
//   isAuthRoute   — sign-in screens. A signed-in user gets bounced to their
//                   workspace so they do not sit on a login form.
//   isPublicRoute — reachable with no session at all. Candidates applying through
//                   a shared job link have no account and never will, so /careers
//                   must never redirect to /login.
//
// An HR user previewing /careers stays there: it is public but not an auth route.

const AUTH_ROUTES = ["/login", "/register"];

const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/careers(\/.*)?$/, // public job board + every shared application link
];

export function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTH_ROUTES.includes(normalise(pathname));
}

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = normalise(pathname);
  return AUTH_ROUTES.includes(path) || PUBLIC_ROUTE_PATTERNS.some((p) => p.test(path));
}

/** Drop a trailing slash so "/careers/" behaves like "/careers". */
function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
