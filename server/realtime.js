import { Server } from "socket.io";
export function attachRealtime(server, { resolveSession, origin }) {
  const io = new Server(server, {
    transports: ["websocket"],
    serveClient: false,
    maxHttpBufferSize: 8192,
    allowRequest: (req, done) => done(null, req.headers.origin === origin),
  });
  io.use(async (socket, next) => {
    try {
      const session = await resolveSession(socket.request);
      if (!session) return next(new Error("Sesi login tidak valid."));
      socket.data.session = session;
      next();
    } catch {
      next(new Error("Sesi belum dapat diperiksa."));
    }
  });
  const end = (socket) => {
    socket.emit("session:ended");
    socket.disconnect(true);
  };
  io.on("connection", (socket) => {
    const session = socket.data.session;
    socket.join("user:" + session.user.id);
    socket.join("session:" + session.key);
    const timer = setTimeout(
      () => end(socket),
      Math.max(0, session.expires - Date.now()),
    );
    timer.unref();
    socket.on("disconnect", () => clearTimeout(timer));
  });
  return {
    io,
    async notifyUser(userId) {
      const sockets = await io.in("user:" + userId).fetchSockets();
      await Promise.all(
        sockets.map(async (socket) => {
          try {
            const session = await resolveSession(socket.request);
            if (!session || session.user.id !== userId) {
              end(socket);
              return;
            }
            socket.emit("notifications:changed");
          } catch {
            socket.disconnect(true);
          }
        }),
      );
    },
    revokeSession(key) {
      for (const socket of io.sockets.sockets.values())
        if (socket.data.session.key === key) end(socket);
    },
  };
}
