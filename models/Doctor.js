const mongoose = require("mongoose");
const { applyIdTransform } = require("./plugins");

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // select: false -> excluded from queries by default; login explicitly opts back in with .select("+passwordHash")
  passwordHash: { type: String, required: true, select: false },

  qualification: { type: String, default: "" },
  registrationNo: { type: String, default: "" },
  pan: { type: String, default: "" },
  gst: { type: String, default: "" },
  bankDetails: { type: String, default: "" },
  signature: { type: String, default: "" },
  invoiceCounter: { type: Number, default: 0 },

  // Prescription / patient-billing specific profile fields
  clinicName: { type: String, default: "" },
  clinicAddress: { type: String, default: "" },
  defaultConsultationFee: { type: Number, default: 0 },
  upiId: { type: String, default: "" },
  prescriptionCounter: { type: Number, default: 0 }
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

applyIdTransform(doctorSchema);

// Defense in depth: `select: false` above keeps passwordHash out of query
// results, but a document already in memory right after .create() or
// .select("+passwordHash") still has it — strip it here too so it can
// never leak into an API response no matter how the doctor was loaded.
doctorSchema.set("toJSON", {
  versionKey: false,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model("Doctor", doctorSchema);
