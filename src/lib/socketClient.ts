import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
// withCredentials sends the login cookie so the gateway knows which private room to join.
export const getSocket = () =>
  (socket ??= io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000", { transports: ["websocket"], withCredentials: true, reconnectionDelayMax: 5000 }));
