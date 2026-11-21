import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/register"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Only accept changes that come from this site's own pages (CSRF defence on
    // top of SameSite cookies). Browsers always send Origin on cross-site POSTs.
    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== req.nextUrl.host) {
        return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
      }
    }
    return NextResponse.next(); // API routes do their own auth checks.
  }

  // Optimistic check: send signed-out visitors to /login.
  const signedIn = Boolean(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  if (PUBLIC_PAGES.includes(pathname)) {
    return signedIn ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg|robots.txt|manifest.webmanifest|apple-icon.png|icon-[^/]*\\.png).*)"],
};
