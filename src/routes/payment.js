const express = require("express");
const { userAuth } = require("../middlewares/auth");
const paymentRouter = express.Router();
const razorpayInstance = require("../services/razorpay");
const Payment = require("../models/payment");
const { membershipAmount } = require("../utils/constants");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");
const User = require("../models/user");

paymentRouter.post("/payment/create", userAuth, async (req, res) => {
  try {
    const { membershipType } = req.body;
    const { firstName, lastName, email } = req.user;

    const order = await razorpayInstance.orders.create({
      amount: membershipAmount[membershipType] * 100,
      currency: "INR",
      receipt: "receipt#1",
      notes: {
        firstName,
        lastName,
        email,
        membershipType: membershipType,
      },
    });

    //Save it in database
    const payment = new Payment({
      userId: req.user._id,
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    });

    const savedPayment = await payment.save();

    //Return Back Order Details To Frontend
    res.json({ savedPayment, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

paymentRouter.post("/payment/webhook", async (req, res) => {
  try {
    const webhookSignature = req.get("X-Razorpay-Signature");
    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );
    if (!isWebhookValid) {
      return res.status(400).json({ message: "Webhook signature is invalid!" });
    }

    // Update payment status in DB
    const paymentDetails = req.body.payload.payment.entity;

    const payment = await payment.findOne({ orderId: paymentDetails.order_id });
    payment.status = paymentDetails.status;
    await payment.save();

    // Update the user as premium
    const user = await User.findOne({ _id: payment.userId });
    user.isPremium = true;
    user.membershipType = payment.notes.membershipType;
    await user.save();

    // Return success response to razorpay
    return res.status(200).json({ message: "Webhook received successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

paymentRouter.get("/premium/verify", userAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.isPremium) {
      return res.json({ isPremium: true });
    }
    return res.json({ isPremium: false });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = paymentRouter;
