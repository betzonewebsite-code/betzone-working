import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BETZONE_BACKEND_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL("/api/admin/settlement", BACKEND_URL);

    incomingUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    const cookie = request.headers.get("cookie");

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      cache: "no-store",
    });

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin settlement proxy]", error);

    return NextResponse.json(
      { error: "Unable to reach the BETZONE backend." },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
