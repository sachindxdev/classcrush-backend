const validator = require("validator");

const validateSignUpData = (req) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName) {
    throw new Error("Please enter your full name.");
  } else if (!validator.isEmail(email)) {
    throw new Error("Please enter a valid Email.");
  } else if (!validator.isStrongPassword(password)) {
    throw new Error("Please enter a strong password");
  }
};

const validateEditProfileData = (req) => {
  const data = req.body;
  const allowedEditFields = [
    "firstName",
    "lastName",
    "email",
    "age",
    "gender",
    "photoUrl",
    "about",
    "skills",
  ];

  const isEditAllowed = Object.keys(data).every((field) =>
    allowedEditFields.includes(field),
  );

  return isEditAllowed;
};

module.exports = { validateSignUpData, validateEditProfileData };
