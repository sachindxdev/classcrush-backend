const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { Chat } = require("../models/chat");

const chatRouter = express.Router();

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;

  if (!targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  const limit = 50;
  const skip = parseInt(req.query.skip) || 0;

  try {
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
    })
      .populate("participants", "firstName lastName photoUrl")
      .populate({
        path: "messages.senderId",
        select: "firstName lastName photoUrl",
      });

    if (!chat) {
      chat = new Chat({
        participants: [userId, targetUserId],
        messages: [],
      });
      await chat.save();

      chat = await chat.populate("participants", "firstName lastName photoUrl");
    }

    const totalMessages = chat.messages.length;
    const paginatedMessages = chat.messages.slice(
      Math.max(0, totalMessages - limit - skip),
      totalMessages - skip || undefined,
    );

    res.json({
      participants: chat.participants,
      messages: paginatedMessages,
      hasMore: totalMessages > limit + skip,
    });
  } catch (err) {
    console.error("Chat fetch error:", err);
    res.status(500).json({ message: "Error fetching chat" });
  }
});

module.exports = chatRouter;
