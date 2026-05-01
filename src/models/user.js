const mongoose = require("mongoose");
const { Schema } = mongoose;
const validator = require("validator");
const jwt = require("jsonwebtoken");

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      minLength: 3,
      maxLength: 50,
    },
    lastName: {
      type: String,
      required: true,
      minLength: 3,
      maxLength: 50,
    },
    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid Email Address: " + value);
        }
      },
    },
    password: {
      type: String,
      required: true,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error("Use a strong password: " + value);
        }
      },
    },
    age: {
      type: Number,
      min: 18,
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "others"],
        message: `{VALUE} is not a valid gender type.`,
      },
      // validate(value) {
      //   if (!["male", "female", "others"].includes(value)) {
      //     throw new Error("Gender data is not valid.");
      //   }
      // },
    },
    photoUrl: {
      type: String,
      default: "https://cdn-icons-png.freepik.com/512/4159/4159471.png",
      validate(value) {
        if (!validator.isURL(value)) {
          throw new Error("Invalid Photo Url: " + value);
        }
      },
    },
    about: {
      type: String,
      default: "This is about section of the user.",
    },
    skills: {
      type: [String],
      set: (skills) => [...new Set(skills)],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },

    resetToken: {
      type: String,
    },
    resetTokenExpiry: {
      type: Date,
    },

    deleteToken: {
      type: String,
    },
    deleteTokenExpiry: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.methods.getJWT = async function () {
  const user = this;
  const token = await jwt.sign({ _id: this._id }, "ChatApp@567#98", {
    expiresIn: "7d",
  });
  return token;
};

module.exports = mongoose.model("User", userSchema);

// const User = mongoose.model("User", userSchema);

// module.exports = User;
