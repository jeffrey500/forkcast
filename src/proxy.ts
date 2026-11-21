import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/register"];

/** Optimistic check: send signed-out visitors to /login. API routes do their own checks. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = Boolean(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  if (PUBLIC_PAGES.includes(pathname)) {
    return signedIn ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!signedIn) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
