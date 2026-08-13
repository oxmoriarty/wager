"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export type TypedSocketClient = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

let socket: TypedSocketClient | undefined;

/** Lazily creates a single shared Socket.IO client with auto-reconnect. */
export function getSocketClient(): TypedSocketClient {
  if (socket) return socket;

  socket = io({
    path: "/api/socket",
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}
