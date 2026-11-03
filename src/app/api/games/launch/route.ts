import { z } from "zod";
import { catalog, signPlayerToken } from "@/lib/server/games";
import { handler, HttpError, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const GET = handler(async (req) => {
  const user = await requireUser(req);
  const id = z.string().max(60).parse(new URL(req.url).searchParams.get("id"));
  const game = catalog().find((g) => g.id === id);
  if (!game) throw new HttpError(404, "Game not found.");
  const token = await signPlayerToken(user.id);
  return json({ url: game.launchUrl.replace("{token}", encodeURIComponent(token)) });
});
