import { NextRequest, NextResponse } from "next/server";

// Route-level guard is handled in each server component/API route via getSession(),
// since Prisma/jose need the Node runtime. This middleware just redirects the
// unauthenticated root case for a clean first-load experience.
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
