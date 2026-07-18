const mongoose = require("mongoose");
const { applyIdTransform } = require("./plugins");

const lineItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  at: { type: Date, required: true }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  mode: { type: String, enum: ["Cash", "GPay"], required: true },
  reference: { type: String, default: "" },
  paidAt: { type: Date, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  hospitalName: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  month: { type: String, required: true },
  description: { type: String, default: "" },
  lineItems: { type: [lineItemSchema], default: [] },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["Submitted", "Approved", "Accounts", "Paid", "Rejected"],
    default: "Submitted"
  },
  rejectionReason: { type: String, default: "" },
  payment: { type: paymentSchema, default: null },
  statusHistory: { type: [statusHistorySchema], default: [] }
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

applyIdTransform(invoiceSchema);

module.exports = mongoose.model("Invoice", invoiceSchema);
