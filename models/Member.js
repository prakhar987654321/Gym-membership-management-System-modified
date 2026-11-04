const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true
    },
    plan: {
      type: String,
      enum: ["Monthly", "Quarterly", "Annual"],
      default: "Monthly",
    },
    status: { 
      type: String,
      enum: ["Active", "Expired"], 
      default: "Active"
    },
    paymentMethod: {
      type: String,
      default: "UPI"
    }
  },
  { 
    timestamps: true 
  }
);

module.exports = mongoose.model("Member", MemberSchema);
