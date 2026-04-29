import { NextRequest, NextResponse } from "next/server"

const AUTH_COOKIE_NAME = "auth-token"
const protectedPrefixes = ["/dashboard", "/installations"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (token) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("next", pathname)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/installations/:path*",
  ],
}
