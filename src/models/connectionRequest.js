const mongoose = require("mongoose");
const { Schema } = mongoose;

const connectionRequestSchema = new Schema(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User", //reference to User collection
      required: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User", //reference to User collection
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ["ignored", "interested", "accepted", "rejected"],
        message: `{VALUE} is not valid status type.`,
      },
    },
  },
  { timestamps: true },
);

connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 });

connectionRequestSchema.pre("save", function () {
  const connectionRequest = this;
  if (this.fromUserId.equals(this.toUserId)) {
    throw new Error("You cannot send request to yourself.");
  }
});

module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
