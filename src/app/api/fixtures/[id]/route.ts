import { db } from "@/lib/server/db";
import { fixtureInclude, toClientFixture } from "@/lib/server/fixtureDto";
import { handler, HttpError, json } from "@/lib/server/http";

export const GET = handler(async (req) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  const f = await db.fixture.findUnique({ where: { id }, include: fixtureInclude });
  if (!f) throw new HttpError(404, "Match not found.", "NOT_FOUND");
  return json({ fixture: toClientFixture(f) });
});
