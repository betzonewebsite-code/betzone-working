import { catalog } from "@/lib/server/games";
import { handler, json } from "@/lib/server/http";

// The public lobby list. Launch URLs are never exposed here; they are built per player in /api/games/launch.
export const GET = handler(async () => json({ games: catalog().map(({ launchUrl, ...g }) => g) }));
