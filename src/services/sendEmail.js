const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { sesClient } = require("./sesClient");

const createSendEmailCommand = (to, subject, html) => {
  return new SendEmailCommand({
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
        Text: {
          Charset: "UTF-8",
          Data: "Open this email in HTML format",
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: "Team ClassCrush <info@classcrush.online>",
  });
};

const sendEmail = async (to, subject, html) => {
  const command = createSendEmailCommand(to, subject, html);

  try {
    return await sesClient.send(command);
  } catch (error) {
    if (error.name === "MessageRejected") {
      console.error("Email rejected:", error.message);
    }
    throw error;
  }
};

module.exports = { sendEmail };
