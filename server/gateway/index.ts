import { createServer } from "http";
import Redis from "ioredis";
import { Server } from "socket.io";
import { env } from "../../src/lib/server/env";
import { verifyAccess } from "../../src/lib/server/jwt";

const FIXTURE_CHANNEL = "betzone:updates";   // published by the ingestion process (server/ingest/sync.ts)
const USER_CHANNEL = "betzone:user";         // published by the money and betting services

/**
 * Real-time gateway. Everyone receives public odds, score and clock updates.
 * Signed-in players also join a private room for balance and bet events.
 */
export function startGateway() {
  const http = createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200); res.end("ok"); } else { res.writeHead(404); res.end(); }
  });
  const allowedOrigins = env.ALLOWED_CLIENT_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  const io = new Server(http, { cors: { origin: allowedOrigins, credentials: true }, transports: ["websocket", "polling"], pingInterval: 20_000, pingTimeout: 20_000 });

  // The browser sends its login cookie on connect. Anonymous visitors may watch odds but get no private events.
  io.use(async (socket, next) => {
    const m = /(?:^|;\s*)bz_at=([^;]+)/.exec(socket.handshake.headers.cookie ?? "");
    const p = m ? await verifyAccess(decodeURIComponent(m[1])) : null;
    if (p) socket.data.userId = p.userId;
    next();
  });
  io.on("connection", (socket) => { if (socket.data.userId) void socket.join(`user:${socket.data.userId}`); });

  const sub = new Redis(env.REDIS_URL);
  void sub.subscribe(FIXTURE_CHANNEL, USER_CHANNEL);
  sub.on("message", (channel, raw) => {
    try {
      const msg = JSON.parse(raw);
      if (channel === FIXTURE_CHANNEL) io.emit("fixtures:update", msg);
      else io.to(`user:${msg.userId}`).emit(`user:${msg.event}`, msg.data);
    } catch (e) { console.error("[gateway] bad message", (e as Error).message); }
  });

  http.listen(env.SOCKET_PORT, () => console.log(`[gateway] Socket.io on :${env.SOCKET_PORT}`));
  return { close: () => { void sub.quit(); io.close(); } };
}

