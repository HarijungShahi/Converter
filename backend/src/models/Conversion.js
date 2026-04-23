const mongoose = require("mongoose");

const conversionSchema = new mongoose.Schema(
  {
    inputName: { type: String, required: true },
    sourceExt: { type: String, required: true },
    targetExt: { type: String, required: true },
    outputName: { type: String, default: "" },
    status: { type: String, enum: ["success", "failed"], required: true },
    message: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversion", conversionSchema);
