import type { Server as HTTPServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./events";

export type TypedSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// A plain module-level `let` isn't guaranteed to be the same instance
// between the raw Node process running server.ts and code compiled
// through Next.js's own bundler (Turbopack in dev keeps a separate
// module registry for anything reachable from the `app` graph). Storing
// it on `globalThis` guarantees both sides see the exact same server —
// same fix as the Prisma client singleton in src/lib/prisma.ts.
const globalForSocket = globalThis as unknown as {
  io: TypedSocketServer | undefined;
};

/** Creates the Socket.IO server once and attaches it to the shared HTTP server. */
export function initSocketServer(httpServer: HTTPServer): TypedSocketServer {
  if (globalForSocket.io) return globalForSocket.io;

  const io: TypedSocketServer = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (room) => socket.join(room));
    socket.on("leave", (room) => socket.leave(room));
  });

  globalForSocket.io = io;
  return io;
}

/**
 * Access the running Socket.IO server from API routes / server actions.
 * Returns `null` instead of throwing when the server hasn't been
 * initialized (e.g. a route handler invoked outside server.ts, such as
 * in a one-off script) so callers can degrade gracefully instead of
 * failing the whole request over a non-critical real-time push.
 */
export function getSocketServer(): TypedSocketServer | null {
  return globalForSocket.io ?? null;
}
