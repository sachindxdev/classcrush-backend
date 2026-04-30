const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");
const ConnectionRequest = require("../models/connectionRequest");

const onlineUsers = new Map();

const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("$"))
    .digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const { userId } = socket.handshake.auth || {};

    if (!userId) {
      console.warn("Socket connected without userId, disconnecting.");
      return socket.disconnect(true);
    }

    onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));

    socket.on("joinChat", ({ targetUserId }) => {
      if (!targetUserId) return;

      const roomId = getSecretRoomId(userId, targetUserId);
      socket.join(roomId);
    });

    socket.on("sendMessage", async ({ targetUserId, text }) => {
      if (!targetUserId || !text || !text.trim()) {
        return socket.emit("errorMessage", { message: "Invalid message" });
      }

      try {
        const roomId = getSecretRoomId(userId, targetUserId);

        const connection = await ConnectionRequest.findOne({
          $or: [
            { fromUserId: userId, toUserId: targetUserId },
            { fromUserId: targetUserId, toUserId: userId },
          ],
          status: "accepted",
        });

        if (!connection) {
          return socket.emit("errorMessage", {
            message: "Not connected",
          });
        }

        let chat = await Chat.findOne({
          participants: { $all: [userId, targetUserId] },
        });

        if (!chat) {
          chat = new Chat({
            participants: [userId, targetUserId],
            messages: [],
          });
        }

        const newMessage = {
          senderId: userId,
          text: text.trim(),
        };

        chat.messages.push(newMessage);
        await chat.save();

        io.to(roomId).emit("messageReceived", {
          senderId: userId,
          text: text.trim(),
          createdAt: new Date(),
        });
      } catch (err) {
        console.error("Socket sendMessage error:", err.message);
        socket.emit("errorMessage", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });
  });
};

module.exports = initializeSocket;
