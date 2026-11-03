import { handler, json } from "@/lib/server/http";
import { publicUser, requireUser } from "@/lib/server/session";

export const GET = handler(async (req) => json({ user: publicUser(await requireUser(req)) }));
