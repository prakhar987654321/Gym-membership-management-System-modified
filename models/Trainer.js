const mongoose = require("mongoose");

const TrainerSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    specialty: {
      type: String, 
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["Available", "Busy", "On Leave"],
      default: "Available",
    },
  },
  { 
    timestamps: true
  }
);

module.exports = mongoose.model("Trainer", TrainerSchema);
