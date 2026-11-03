import type { NextRequest } from "next/server";
import { requireUser } from "./session";

/** The signed-in user, or null for visitors. Use on public pages that show extra detail to players. */
export async function optionalUser(req: NextRequest) {
  try { return await requireUser(req); } catch { return null; }
}
