const express = require("express");

const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");
const Invoice = require("../models/Invoice");
const { authMiddleware } = require("../utils/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { generateInvoicePdf } = require("../utils/pdfGenerator");

const router = express.Router();

const VALID_STATUSES = ["Submitted", "Approved", "Accounts", "Paid", "Rejected"];

function buildLineItems(hospital, formValues) {
  const lineItems = [];
  for (const field of hospital.requiredFields) {
    const raw = formValues[field.key];
    if (raw === undefined || raw === null || raw === "") continue;

    if (field.type === "amount") {
      const amount = Number(raw);
      if (amount > 0) lineItems.push({ label: field.label, amount });
    } else if (field.type === "number") {
      const qty = Number(raw);
      const rate = field.rate || 0;
      if (qty > 0) {
        lineItems.push({ label: `${field.label} (${qty} x INR ${rate})`, amount: qty * rate });
      }
    }
  }
  return lineItems;
}

// POST /api/invoices - create a new invoice
router.post("/", authMiddleware, asyncHandler(async (req, res) => {
  const { hospitalId, month, formValues, description } = req.body;
  if (!hospitalId || !month || !formValues) {
    return res.status(400).json({ error: "hospitalId, month and formValues are required" });
  }
  // description is optional - a free-text note that appears on the PDF if provided

  const [doctor, hospital] = await Promise.all([
    Doctor.findById(req.doctorId),
    Hospital.findById(hospitalId)
  ]);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  // Validation warnings mirroring the "AI Invoice Validator" concept from the spec
  const warnings = [];
  if (hospital.requiresSignature && !doctor.signature) {
    warnings.push("This hospital requires your digital signature. Add one in your profile.");
  }
  if (hospital.requiresGST && !doctor.gst) {
    warnings.push("This hospital requires a GSTIN. Add one in your profile.");
  }
  if (!doctor.pan) {
    warnings.push("PAN is missing from your profile. Most hospitals require it.");
  }

  const lineItems = buildLineItems(hospital, formValues);
  if (lineItems.length === 0) {
    return res.status(400).json({ error: "At least one billable field must have a value greater than 0" });
  }

  const total = lineItems.reduce((sum, li) => sum + li.amount, 0);

  doctor.invoiceCounter = (doctor.invoiceCounter || 0) + 1;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(doctor.invoiceCounter).padStart(3, "0")}`;
  await doctor.save();

  const invoice = await Invoice.create({
    doctorId: doctor.id,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    invoiceNumber,
    month,
    description: description || "",
    lineItems,
    total,
    status: "Submitted",
    payment: null,
    statusHistory: [{ status: "Submitted", at: new Date() }]
  });

  res.status(201).json({ invoice: invoice.toJSON(), warnings });
}));

// GET /api/invoices - list invoices for the logged-in doctor
router.get("/", authMiddleware, asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ doctorId: req.doctorId }).sort({ createdAt: -1 });
  res.json(invoices.map((inv) => inv.toJSON()));
}));

// GET /api/invoices/:id
router.get("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json(invoice.toJSON());
}));

// PATCH /api/invoices/:id/status - move invoice through the payment tracker
router.patch("/:id/status", authMiddleware, asyncHandler(async (req, res) => {
  const { status, rejectionReason, paymentMode, paymentReference } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
  }
  if (status === "Paid" && !["Cash", "GPay"].includes(paymentMode)) {
    return res.status(400).json({ error: "paymentMode must be Cash or GPay when marking an invoice as Paid" });
  }

  const invoice = await Invoice.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  invoice.status = status;
  invoice.statusHistory.push({ status, at: new Date() });
  if (status === "Rejected") {
    invoice.rejectionReason = rejectionReason || "Not specified";
  }
  if (status === "Paid") {
    invoice.payment = {
      mode: paymentMode,
      reference: paymentMode === "GPay" ? (paymentReference || "") : "",
      paidAt: new Date()
    };
  }

  await invoice.save();
  res.json(invoice.toJSON());
}));

// DELETE /api/invoices/:id - permanently remove an invoice
router.delete("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, doctorId: req.doctorId });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json({ deleted: true, id: invoice.id });
}));

// GET /api/invoices/:id/pdf - generate & download the invoice PDF
router.get("/:id/pdf", authMiddleware, asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const [doctor, hospital] = await Promise.all([
    Doctor.findById(invoice.doctorId),
    Hospital.findById(invoice.hospitalId)
  ]);

  try {
    const { pdfBytes } = await generateInvoicePdf(invoice.toJSON(), doctor.toJSON(), hospital.toJSON());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}));

module.exports = router;
