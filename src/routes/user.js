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

// Forgot Password
userRouter.post("/user/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;

    await user.save();

    const link = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendEmail(
      email,
      "Reset your ClassCrush password",
      `
  <div style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding: 30px;">
    
    <div style="max-width:500px; margin:auto; background:white; border-radius:10px; padding:25px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      
      <h2 style="text-align:center; color:#4CAF50; margin-bottom:10px;">
        ClassCrush 🔐
      </h2>

      <h3 style="text-align:center; margin-top:0;">
        Reset Your Password
      </h3>

      <p style="font-size:15px; color:#555;">
        Hi <strong>${user.firstName}</strong>,
      </p>

      <p style="font-size:14px; color:#555;">
        We received a request to reset your password. Click the button below to set a new one.
      </p>

      <div style="text-align:center; margin:25px 0;">
        <a href="${link}" 
          style="background:#4CAF50; color:white; padding:12px 22px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
          Reset Password
        </a>
      </div>

      <p style="font-size:13px; color:#777;">
        This link will expire in <strong>15 minutes</strong>.
      </p>

      <p style="font-size:13px; color:#777;">
        If you didn't request this, you can safely ignore this email.
      </p>

      <hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

      <p style="font-size:12px; color:#aaa; text-align:center;">
        © ${new Date().getFullYear()} ClassCrush. All rights reserved.
      </p>

    </div>
  </div>
  `,
    );

    return res.json({ message: "Reset link sent to email!" });
  } catch (err) {
    return res.status(400).json({
      message: err.message || "Something went wrong",
    });
  }
});

//Reset Password
userRouter.patch("/user/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and password required",
      });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    await sendEmail(
      user.email,
      "Your ClassCrush password was reset successfully",
      `
  <div style="font-family: Arial, sans-serif; background-color:#f4f6f8; padding: 30px;">
    
    <div style="max-width:500px; margin:auto; background:white; border-radius:10px; padding:25px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      
      <h2 style="text-align:center; color:#4CAF50; margin-bottom:10px;">
        ClassCrush 💕🎉
      </h2>

      <h3 style="text-align:center; margin-top:0;">
        Password Reset Successful
      </h3>

      <p style="font-size:15px; color:#555;">
        Hi <strong>${user.firstName}</strong>,
      </p>

      <p style="font-size:14px; color:#555;">
        Your password has been successfully updated. You can now log in with your new password.
      </p>

      <div style="text-align:center; margin:25px 0;">
        <a href="${process.env.CLIENT_URL}/login" 
          style="background:#4CAF50; color:white; padding:12px 22px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
          Visit ClassCrush
        </a>
      </div>

      <p style="font-size:13px; color:#777;">
        If you did not perform this action, please reset your password immediately or contact support.
      </p>

      <hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

      <p style="font-size:12px; color:#aaa; text-align:center;">
        © ${new Date().getFullYear()} ClassCrush. All rights reserved.
      </p>

    </div>
  </div>
  `,
    );

    return res.json({ message: "Password reset successful!" });
  } catch (err) {
    return res.status(400).json({
      message: err.message || "Something went wrong",
    });
  }
});

module.exports = userRouter;
