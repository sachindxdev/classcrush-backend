const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_EMAIL_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    const response = await resend.emails.send({
      from: "ClassCrush <info@classcrush.online>",
      to: to,
      subject: subject,
      html: html,
    });

    return response;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};

module.exports = { sendEmail };
