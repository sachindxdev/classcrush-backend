const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const userRouter = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendEmail } = require("../services/sendEmail");

const USER_SAFE_DATA = "firstName lastName photoUrl age gender about skills";

//Get all the pending/received connection requests for loggedInUser
userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate(
      "fromUserId",
      "firstName lastName photoUrl age gender about skills",
    );
    // }).populate("fromUserId", ["firstName", "lastName", "photoUrl", "age", "gender", "about", "skills"]);

    res.json({
      message: "Connection Requests Received.",
      data: connectionRequests,
    });
  } catch (err) {
    res.send("ERROR: " + err.message);
  }
});

//Get all the connections of loggedInUser
userRouter.get("/user/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id, status: "accepted" },
        { fromUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .populate("toUserId", USER_SAFE_DATA);

    const data = connectionRequests.map((row) => {
      if (row.fromUserId.equals(loggedInUser._id)) {
        return row.toUserId;
      } else {
        return row.fromUserId;
      }
    });

    res.json({
      message: "Your List of Connections.",
      data: data,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

//User Feed
userRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;

    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      $or: [{ fromUserId: loggedInUser._id }, { toUserId: loggedInUser._id }],
    }).select("fromUserId toUserId");

    const hideUsersFromFeed = new Set();
    connectionRequests.forEach((connection) => {
      hideUsersFromFeed.add(connection.fromUserId.toString());
      hideUsersFromFeed.add(connection.toUserId.toString());
    });

    const feedUsers = await User.find({
      $and: [
        { _id: { $nin: Array.from(hideUsersFromFeed) } },
        { _id: { $ne: loggedInUser._id } },
      ],
    })
      .select(USER_SAFE_DATA)
      .skip(skip)
      .limit(limit);

    res.send(feedUsers);
  } catch (err) {
    res.status(500).json({ Error: err.message });
  }
});

//Reset Password
userRouter.patch("/user/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User Not Found!" });
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");

    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          password: hashPassword,
          verificationToken: emailVerificationToken,
          isVerified: false,
        },
      },
      { runValidators: true },
    );

    const { firstName } = user;

    const link = `${process.env.CLIENT_URL}/verify?token=${emailVerificationToken}`;

    await sendEmail(
      email,
      "Verify your ClassCrush account",
      `<div style="font-family: Arial; padding: 20px;">
      <h2>Welcome to ClassCrush 👋</h2>
      <p>Hi ${firstName},</p>
      <p>Please verify your email to reset your password.</p>
      <a href="${link}" 
       style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">
       Verify Email
       </a>
      </div>`,
    );

    return res.json({
      message: "Password reset successful.",
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message || "Something went wrong",
    });
  }
});

module.exports = userRouter;
