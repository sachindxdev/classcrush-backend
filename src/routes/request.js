const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const requestRouter = express.Router();
const { sendEmail } = require("../services/sendEmail");

requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    try {
      const fromUserId = req.user._id;

      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const allowedStatus = ["ignored", "interested"];
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid Status Type: " + status });
      }

      //Use This or it is done in connectionRequest Schema using Pre.
      // if (toUserId === fromUserId.toString()) {
      //   return res
      //     .status(400)
      //     .json({ message: "You cannot send request to yourself." });
      // }

      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ message: "User does not exist!!" });
      }

      const existingConnectionRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId: fromUserId, toUserId: toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });

      if (existingConnectionRequest) {
        return res
          .status(400)
          .json({ message: "Connection Request Already Exists!!" });
      }

      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });
      const data = await connectionRequest.save();

      // SEND EMAIL
      if (status === "interested") {
        await sendEmail(
          toUser.email,
          "New Connection Request",
          `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
  
  <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    
    <h2 style="color: #111827; text-align: center;">
      💕 New Connection on ClassCrush
    </h2>

    <p style="font-size: 16px; color: #374151;">
      Hi there,
    </p>

    <p style="font-size: 16px; color: #374151;">
      <strong>${req.user.firstName}</strong> just showed interest in connecting with you on <strong>ClassCrush</strong>.
    </p>

    <p style="font-size: 15px; color: #6b7280;">
      This could be the start of something exciting — a new friendship, collaboration, or maybe even more 😉. 
      Don't miss out — check their profile and respond to the request.
    </p>

    <div style="text-align: center; margin: 20px 0;">
       <a href="${process.env.CLIENT_URL}/requests"
         style="background-color: #f43f5e; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        View Request
      </a>
    </div>

    <p style="font-size: 13px; color: #9ca3af; text-align: center;">
      You're receiving this because you have an active ClassCrush account.
    </p>

  </div>

</div>
`,
        );
      }

      const actionText =
        status === "interested" ? `is interested in` : `has ${status}`;

      res.json({
        message: `${req.user.firstName} ${actionText} ${toUser.firstName}`,
        data,
      });
    } catch (err) {
      res.status(400).json({
        message: err.message,
      });
    }
  },
);

requestRouter.post(
  "/request/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const { status, requestId } = req.params;

      const allowedStatus = ["accepted", "rejected"];
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid Status Type: " + status });
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: loggedInUser._id,
        status: "interested",
      });

      if (!connectionRequest) {
        return res
          .status(404)
          .json({ message: "Connection Request Not Found!!!" });
      }

      connectionRequest.status = status;
      const data = await connectionRequest.save();

      // SEND EMAIL
      if (status === "accepted") {
        const fromUser = await User.findById(connectionRequest.fromUserId);
        await sendEmail(
          fromUser.email,
          "Request Accepted 🎉",
          `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
    
    <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      
      <h2 style="color: #111827; text-align: center;">
        Hurray!! 😍🎉
      </h2>

      <p style="font-size: 16px; color: #374151;">
        Hi there,
      </p>

      <p style="font-size: 16px; color: #374151;">
        <strong>${loggedInUser.firstName}</strong> has accepted your connection request on <strong>ClassCrush</strong>.
      </p>

      <p style="font-size: 15px; color: #6b7280;">
        You can now start chatting and explore this new connection 🚀
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.CLIENT_URL}/connections"
           style="background-color: #10b981; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View Connections
        </a>
      </div>

      <p style="font-size: 13px; color: #9ca3af; text-align: center;">
        You're receiving this because you have an active ClassCrush account.
      </p>

    </div>

  </div>
  `,
        );
      }

      res.json({ message: `Connection request ${status}.`, data });
    } catch (err) {
      res.send("ERROR: " + err.message);
    }
  },
);

module.exports = requestRouter;
