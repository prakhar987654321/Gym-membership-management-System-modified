const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    amount: { 
      type: Number, 
      required: true 
    },
    plan: {
      type: String,
      enum: ["Monthly", "Quarterly", "Annual"],
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "UPI"
    },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Completed",
    },
  },
  { 
    timestamps: true 
  }
);

module.exports = mongoose.model("Payment", PaymentSchema);
