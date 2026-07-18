const mongoose = require("mongoose");
const { applyIdTransform } = require("./plugins");

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, default: "" },
  frequency: { type: String, default: "" },
  duration: { type: String, default: "" },
  instructions: { type: String, default: "" }
}, { _id: false });

const prescriptionPaymentSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "paid"], default: "pending" },
  mode: { type: String, enum: ["Cash", "GPay", null], default: null },
  reference: { type: String, default: "" },
  paidAt: { type: Date, default: null }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
  prescriptionNumber: { type: String, required: true },

  patientName: { type: String, required: true },
  patientAge: { type: String, default: "" },
  patientGender: { type: String, default: "" },
  patientPhone: { type: String, default: "" },

  date: { type: Date, required: true },
  diagnosis: { type: String, default: "" },
  medicines: { type: [medicineSchema], default: [] },
  advice: { type: String, default: "" },
  followUpDate: { type: String, default: "" },
  consultationFee: { type: Number, default: 0 },

  payment: {
    type: prescriptionPaymentSchema,
    default: () => ({ status: "pending", mode: null, reference: "", paidAt: null })
  }
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

applyIdTransform(prescriptionSchema);

module.exports = mongoose.model("Prescription", prescriptionSchema);
