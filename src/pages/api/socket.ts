// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer } from "socket.io";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: any & { server: any };
};

export const config = {
  api: { bodyParser: false },
};

// stato in memoria
const games = new Map<string, any>();

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socket_io",
      addTrailingSlash: false,
    });

    io.on("connection", (socket) => {
      socket.on("join", ({ gameId }: { gameId: string }) => {
        if (!games.has(gameId)) return;
        socket.join(gameId);
        socket.emit("game:update", games.get(gameId));
      });

      socket.on("host:create", (gameState: any, cb?: (payload: any) => void) => {
        const gameId = id("game");
        games.set(gameId, gameState);
        cb?.({ gameId });
      });

      socket.on("host:update", ({ gameId, gameState }: { gameId: string; gameState: any }) => {
        if (!games.has(gameId)) return;
        games.set(gameId, gameState);
        io.to(gameId).emit("game:update", gameState);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
