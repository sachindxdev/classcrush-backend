const express = require("express");
const { validateSignUpData } = require("../utils/validation");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const crypto = require("crypto");
const { sendEmail } = require("../services/sendEmail");
const authRouter = express.Router();

//Create a User
authRouter.post("/signup", async (req, res) => {
  try {
    //Validation of data
    validateSignUpData(req);

    const { firstName, lastName, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        message: "You have already an account.",
      });
    }

    //Encrypt Password
    const passwordHash = await bcrypt.hash(password, 10);

    //generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    //Save Data in Database
    const user = new User({
      firstName,
      lastName,
      email,
      password: passwordHash,
      verificationToken,
      isVerified: false,
    });

    const savedUser = await user.save();

    //Send Verification Email
    const link = `${process.env.CLIENT_URL}/verify?token=${verificationToken}`;

    await sendEmail(
      process.env.AWS_VERIFIED_EMAIL,
      //email - when aws production ses on
      "Verify your ClassCrush account",
      `<div style="font-family: Arial; padding: 20px;">
    <h2>Welcome to ClassCrush 👋</h2>
    <p>Hi ${firstName},</p>
    <p>Thanks for signing up! Please verify your email to get started.</p>

    <a href="${link}" 
       style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:5px;">
       Verify Email
    </a>

    <p style="margin-top:20px;font-size:12px;color:gray;">
      If you didnt sign up, you can ignore this email.
    </p>
  </div>`,
    );

    res.json({
      message: "Signup successful. Check your email.",
      data: savedUser,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message || "Something went wrong",
    });
  }
});

//Verify email of user
authRouter.get("/verify", async (req, res) => {
  try {
    const { token } = req.query;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      const alreadyVerifiedUser = await User.findOne({
        isVerified: true,
      });

      if (alreadyVerifiedUser) {
        return res.json({
          message: "Email already verified",
        });
      }

      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    if (user.isVerified) {
      return res.json({
        message: "Email already verified",
      });
    }

    user.isVerified = true;
    user.verificationToken = null;

    const savedUser = await user.save();

    const jwtToken = savedUser.getJWT();

    res.cookie("token", jwtToken, {
      httpOnly: true,
      expires: new Date(Date.now() + 8 * 3600000),
    });

    res.json({
      message: "Email verified successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

//Login User
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    if (!user.isVerified) {
      return res.status(400).json({
        message: "Please verify your email first",
      });
    }

    const token = await user.getJWT();

    res.cookie("token", token, {
      expires: new Date(Date.now() + 8 * 3600000),
      httpOnly: true,
    });

    return res.send(user);
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Something went wrong",
    });
  }
});

//Logout
authRouter.post("/logout", async (req, res) => {
  try {
    res.cookie("token", null, { expires: new Date(Date.now()) });
    res.send("Logout Successful.");
  } catch (error) {
    res.status(400).send("ERROR: " + error.message);
  }
});

module.exports = authRouter;
