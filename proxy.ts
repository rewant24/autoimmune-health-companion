import { NextResponse, type NextRequest } from "next/server";

const LEGACY_HOSTS = new Set([
  "saumya-health-companion.vercel.app",
  "saumya-health-companion-rewant24s-projects.vercel.app",
  "saumya-health-companion-rewant24-rewant24s-projects.vercel.app",
  "sakhi-health-companion.vercel.app",
  "autoimmune-health-companion.vercel.app",
  "autoimmune-health-companion-rewant24s-projects.vercel.app",
  "autoimmune-health-companion-rewant24-rewant24s-projects.vercel.app",
]);
const CANONICAL_HOST = "saha-health-companion.vercel.app";

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
