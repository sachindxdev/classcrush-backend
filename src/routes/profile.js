const express = require("express");
const profileRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const { validateEditProfileData } = require("../utils/validation");
const User = require("../models/user");
const ConnectionRequest = require("../models/connectionRequest");
const { Chat } = require("../models/chat");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../services/sendEmail");

//Show Profile
profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.send(user);
  } catch (err) {
    res.status(400).send("Error Login : " + err.message);
  }
});

//Edit Profile
profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
  try {
    if (!validateEditProfileData(req)) {
      throw new Error("Invalid Edit Request.");
    }
    const loggedInUser = req.user;

    Object.keys(req.body).forEach((key) => (loggedInUser[key] = req.body[key]));

    await loggedInUser.save();

    res.json({
      message: `${loggedInUser.firstName}, your profile updated successfully!`,
      data: loggedInUser,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
});

profileRouter.post(
  "/profile/request/delete-account",
  userAuth,
  async (req, res) => {
    try {
      const user = req.user;

      const token = crypto.randomBytes(32).toString("hex");

      user.deleteToken = token;
      user.deleteTokenExpiry = Date.now() + 10 * 60 * 1000;

      await user.save();

      const link = `${process.env.CLIENT_URL}/profile/verify/delete-account?token=${token}`;

      await sendEmail(
        user.email,
        "Confirm Account Deletion ⚠️",
        `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Delete Your Account</h2>
          <p>Hi ${user.firstName},</p>
          <p>Click below to permanently delete your account.</p>
          <a href="${link}" 
             style="display:inline-block;padding:10px 20px;background:red;color:white;text-decoration:none;border-radius:5px;">
             Delete Account
          </a>
          <p>This action cannot be undone.</p>
        </div>
        `,
      );

      res.json({ message: "Delete confirmation email sent." });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

profileRouter.delete("/profile/verify/delete-account", async (req, res) => {
  try {
    const token = req.query.token?.trim();

    const user = await User.findOne({
      deleteToken: token,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid token",
      });
    }

    if (user.deleteTokenExpiry < Date.now()) {
      return res.status(400).json({
        message: "Token expired",
      });
    }

    const userId = user._id;

    await ConnectionRequest.deleteMany({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    });

    await Chat.deleteMany({
      participants: userId,
    });

    await User.findByIdAndDelete(userId);

    res.clearCookie("token");

    await sendEmail(
      user.email,
      "Your ClassCrush Account Has Been Deleted 🥺",
      `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
    
    <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      
      <h2 style="color: #111827; text-align: center;">
        Account Deleted 😔
      </h2>

      <p style="font-size: 16px; color: #374151;">
        Hi ${user.firstName},
      </p>

      <p style="font-size: 16px; color: #374151;">
        Your <strong>ClassCrush</strong> account has been successfully deleted.
      </p>

      <p style="font-size: 15px; color: #6b7280;">
        We're sorry to see you go 💔. If this was a mistake or you change your mind,
        you're always welcome to join us again anytime.
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.CLIENT_URL}" 
           style="background-color: #3b82f6; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Visit ClassCrush
        </a>
      </div>

      <p style="font-size: 13px; color: #9ca3af; text-align: center;">
        This action is permanent and cannot be undone.
      </p>

    </div>

  </div>
  `,
    );

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.log("ERROR:", err);
    res.status(400).json({ message: err.message });
  }
});
module.exports = profileRouter;
