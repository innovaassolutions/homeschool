// Temporarily disabled to debug auth issues
// import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// export default convexAuthNextjsMiddleware();

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
