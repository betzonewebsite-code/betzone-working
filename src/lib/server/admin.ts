import type { NextRequest } from "next/server";
import { HttpError } from "./http";
import { requireUser } from "./session";

export async function requireAdmin(req: NextRequest) {
  const u = await requireUser(req);
  if (u.role !== "ADMIN") throw new HttpError(403, "Not allowed.", "FORBIDDEN");
  return u;
}
