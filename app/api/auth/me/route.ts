import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const auth = authenticateApiRequest(request)
  if (auth.response) return auth.response

  return NextResponse.json(auth.user, { status: 200 })
}
