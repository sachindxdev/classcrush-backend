const express = require("express");
const { userAuth } = require("../middlewares/auth");
const { validateEditProfileData } = require("../utils/validation");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const profileRouter = express.Router();

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

//Reset Password
profileRouter.patch("/profile/password", async (req, res) => {
  try {
    const { token } = req.cookies;

    if (token) {
      const allowedField = ["password"];
      const isAllowedValid = Object.keys(req.body).every((field) =>
        allowedField.includes(field),
      );

      if (!isAllowedValid) {
        throw new Error("Invalid Field");
      }

      const { password } = req.body;

      const hashPassword = await bcrypt.hash(password, 10);

      const decodedObj = jwt.verify(token, "ChatApp@567#98");
      const { _id } = decodedObj;

      await User.findByIdAndUpdate(
        _id,
        { password: hashPassword },
        { runValidators: true },
      );

      res.clearCookie("token");

      return res.send("Password reset successful.");
    }

    const allowedField = ["email", "currentPassword", "newPassword"];
    const isAllowedValid = Object.keys(req.body).every((field) =>
      allowedField.includes(field),
    );

    if (!isAllowedValid) {
      throw new Error("Invalid Field");
    }

    const { email, currentPassword, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("Invalid Email ID or Password");
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new Error("Invalid Email ID or Password");
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(
      user._id,
      { password: hashPassword },
      { runValidators: true },
    );

    return res.send("Password reset successful.");
  } catch (error) {
    res.status(400).send("ERROR: " + error.message);
  }
});

module.exports = profileRouter;
