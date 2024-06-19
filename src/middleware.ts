import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

//Middleware gets the requested pathname and adds it as a header on the request
//This allows accessing the current path in server components.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
