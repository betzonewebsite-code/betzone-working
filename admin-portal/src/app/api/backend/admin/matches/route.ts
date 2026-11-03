import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BETZONE_BACKEND_URL || "http://localhost:3000";

async function proxy(request: NextRequest) {
  try {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL("/api/admin/matches", BACKEND_URL);

    incomingUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    const cookie = request.headers.get("cookie");
    const contentType = request.headers.get("content-type");
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body } : {}),
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
    console.error("[admin matches proxy]", error);
    return NextResponse.json(
      { error: "Unable to reach the BETZONE backend." },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
