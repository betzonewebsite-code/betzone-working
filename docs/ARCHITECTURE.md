# BetZone architecture (current)

## Processes
| Process | Command | Job |
|---|---|---|
| Web + REST API | `next dev` | Pages and `/api/*` routes |
| Platform server | `npm run platform` | Socket.io gateway, settlement, cash-out, jackpot and payout workers |
| Sports ingest | `npm run ingest` | Pulls fixtures and odds from SportsGameOdds (primary) and The Odds API (result check) into Postgres |
| PostgreSQL + Redis | `npm run db:up` | Source of truth, queues, pub/sub |

## Data flow
ingest -> Postgres -> Redis `betzone:updates` -> gateway -> browsers. Money services publish private events on `betzone:user`.

## Money rules
- Decimal everywhere. Append-only ledger. Every money action has an idempotency key.
- Wallet changes only inside `prisma.$transaction` with the wallet row locked. A CHECK constraint refuses negative balances.
- Bets are placed, settled and cashed out only on the server. The browser never decides an amount.
- Settlement waits for two data sources to agree on a final score (or for `SPORTS_SECONDARY=none`).

## Sections
Sports, Live, Jackpot (`server/tools/create-jackpot.ts` opens rounds), Feed (shared booking codes), Promotions (static, real features only),
Games and Virtuals (lobby plus a generic provider wallet API at `/api/games/wallet`; needs a licensed provider).

## Before real money
Gambling licence, commercial data licence, payment provider approval for gambling, KYC and AML, responsible-gambling tools, security review.
