const cron = require("node-cron");
const { subDays, startOfDay, endOfDay } = require("date-fns");
const ConnectionRequest = require("../models/connectionRequest");
const { sendEmail } = require("./sendEmail");

// Runs every day at 8 AM IST
cron.schedule(
  "0 8 * * *",
  async () => {
    try {
      const yesterday = subDays(new Date(), 1);

      const yesterdayStart = startOfDay(yesterday);
      const yesterdayEnd = endOfDay(yesterday);

      // Get yesterday's "interested" requests
      const pendingRequests = await ConnectionRequest.find({
        status: "interested",
        createdAt: {
          $gte: yesterdayStart,
          $lt: yesterdayEnd,
        },
      }).populate("fromUserId toUserId");

      if (!pendingRequests.length) {
        console.log("No pending requests found.");
        return;
      }

      const sentEmails = new Set();

      for (const req of pendingRequests) {
        const user = req.toUserId;

        // skip invalid or duplicate users
        if (!user || !user.email || sentEmails.has(user.email)) continue;

        sentEmails.add(user.email);

        try {
          await sendEmail(
            user.email,
            "You have new connection requests 💕",
            `
            <div style="font-family: Arial; padding: 20px;">

              <p>Hi ${user.firstName || "there"},</p>

              <p>You have pending connection requests on ClassCrush.</p>
              <p>Log in to review and respond.</p>

              <a href="${process.env.CLIENT_URL}/requests"
                style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">
                View Requests
              </a>

              <p style="margin-top:20px;font-size:12px;color:gray;">
                See who's interested in you 👀
              </p>
            </div>
            `,
          );

          console.log("Email sent to:", user.email);
        } catch (err) {
          console.error("Email failed for:", user.email, err.message);
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
