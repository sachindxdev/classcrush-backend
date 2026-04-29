const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { Chat } = require("../models/chat");

const chatRouter = express.Router();

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;

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

    res.json({
      participants: chat.participants,
      messages: chat.messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching chat" });
  }
});

module.exports = chatRouter;
