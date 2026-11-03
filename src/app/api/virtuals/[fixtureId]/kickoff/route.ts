import { handler, HttpError } from "@/lib/server/http";

export const POST = handler(async () => {
  throw new HttpError(
    410,
    "Catalogue kickoff is disabled. Start virtual matches from your placed Instant Virtual ticket.",
    "TICKET_KICKOFF_REQUIRED"
  );
});
