const mongoose = require("mongoose");
const { applyIdTransform } = require("./plugins");

const requiredFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ["number", "amount"], required: true },
  rate: { type: Number } // only used when type === "number"
}, { _id: false });

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  requiredFields: { type: [requiredFieldSchema], default: [] },
  requiresSignature: { type: Boolean, default: false },
  requiresGST: { type: Boolean, default: false },
  notes: { type: String, default: "" },
  // Which doctor added this template (hospitals are shared across all doctors, like the old store)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

applyIdTransform(hospitalSchema);

module.exports = mongoose.model("Hospital", hospitalSchema);
