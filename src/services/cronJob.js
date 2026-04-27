const cron = require("node-cron");
const { subDays, startOfDay, endOfDay } = require("date-fns");
const { sendEmail } = require("./sendEmail");
const ConnectionRequest = require("../models/connectionRequest");

// Runs every day at 8 AM
cron.schedule(
  "0 8 * * *",
  async () => {
    try {
      const yesterday = subDays(new Date(), 1);

      const yesterdayStart = startOfDay(yesterday);
      const yesterdayEnd = endOfDay(yesterday);

      const pendingRequests = await ConnectionRequest.find({
        status: "interested",
        createdAt: {
          $gte: yesterdayStart,
          $lt: yesterdayEnd,
        },
      }).populate("fromUserId toUserId");

      // collect unique emails
      const listOfEmails = [
        ...new Set(pendingRequests.map((req) => req.toUserId.email)),
      ];

      // console.log("Emails to notify:", listOfEmails);

      //Send Email
      for (const email of listOfEmails) {
        try {
          await sendEmail(
            //   email,
            process.env.AWS_VERIFIED_EMAIL,
            "You have new connection requests 💕",
            `
          <div style="font-family: Arial; padding: 20px;">
            <h2>New Connection Requests</h2>
            <p>You have pending connection requests on ClassCrush.</p>
            <p>Log in to review and respond.</p>

            <a href="${process.env.CLIENT_URL}/requests"
              style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">
              View Requests
            </a>
          </div>
          `,
          );

          // console.log("Email sent to:", email);
        } catch (err) {
          // console.error("Email failed for:", email, err.message);
          console.error("Email failed!", err.message);
        }
      }
    } catch (err) {
      console.error("Cron job error:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  },
);
