const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(
    "mongodb+srv://chatapp_db:rdiDlt86YRfQO3uY@chatdb.obn8xgv.mongodb.net/classCrush",
  );
};

module.exports = connectDB;
