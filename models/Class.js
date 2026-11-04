const mongoose = require("mongoose");

const ClassSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    trainer: { 
      type: String, 
      required: true,
      trim: true
    },
    timing: {
      type: String, 
      required: true,
      trim: true
    },
    total: {
      type: Number, 
      default: 20 
    },
    booked: { 
      type: Number, 
      default: 0 
    },
  },
  { 
    timestamps: true 
  }
);

module.exports = mongoose.model("Class", ClassSchema);
