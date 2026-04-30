import { NextResponse, type NextRequest } from "next/server";

// Public-reachable legacy Vercel aliases that should 308 to the canonical
// custom domain. Excludes `*-rewant24s-projects.vercel.app` aliases — those
// are SSO-blocked at the edge before this proxy runs, so listing them has no
// effect (per Saha rebrand learning #d, 2026-04-25).
const LEGACY_HOSTS = new Set([
  "saha-health-companion.vercel.app",
  "saumya-health-companion.vercel.app",
]);
const CANONICAL_HOST = "www.meetsaha.com";

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (LEGACY_HOSTS.has(host)) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
