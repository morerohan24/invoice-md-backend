const express = require("express");

const Doctor = require("../models/Doctor");
const Prescription = require("../models/Prescription");
const { authMiddleware } = require("../utils/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { generatePrescriptionPdf } = require("../utils/prescriptionPdfGenerator");

const router = express.Router();

// POST /api/prescriptions - write a new prescription for a patient
router.post("/", authMiddleware, asyncHandler(async (req, res) => {
  const {
    patientName,
    patientAge,
    patientGender,
    patientPhone,
    date,
    diagnosis,
    medicines,
    advice,
    followUpDate,
    consultationFee
  } = req.body;

  if (!patientName || !patientName.trim()) {
    return res.status(400).json({ error: "Patient name is required" });
  }
  if (!Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ error: "Add at least one medicine" });
  }
  const cleanMedicines = medicines
    .map((m) => ({
      name: (m.name || "").trim(),
      dosage: (m.dosage || "").trim(),
      frequency: (m.frequency || "").trim(),
      duration: (m.duration || "").trim(),
      instructions: (m.instructions || "").trim()
    }))
    .filter((m) => m.name);
  if (cleanMedicines.length === 0) {
    return res.status(400).json({ error: "Each medicine needs at least a name" });
  }

  const doctor = await Doctor.findById(req.doctorId);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });

  doctor.prescriptionCounter = (doctor.prescriptionCounter || 0) + 1;
  const prescriptionNumber = `RX-${new Date().getFullYear()}-${String(doctor.prescriptionCounter).padStart(3, "0")}`;
  await doctor.save();

  const prescription = await Prescription.create({
    doctorId: doctor.id,
    prescriptionNumber,
    patientName: patientName.trim(),
    patientAge: patientAge || "",
    patientGender: patientGender || "",
    patientPhone: patientPhone || "",
    date: date ? new Date(date) : new Date(),
    diagnosis: (diagnosis || "").trim(),
    medicines: cleanMedicines,
    advice: (advice || "").trim(),
    followUpDate: followUpDate || "",
    consultationFee: Number(consultationFee) || 0,
    payment: { status: "pending", mode: null, reference: "", paidAt: null }
  });

  res.status(201).json(prescription.toJSON());
}));

// GET /api/prescriptions - list prescriptions for the logged-in doctor
router.get("/", authMiddleware, asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ doctorId: req.doctorId }).sort({ createdAt: -1 });
  res.json(prescriptions.map((p) => p.toJSON()));
}));

// GET /api/prescriptions/:id
router.get("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!prescription) return res.status(404).json({ error: "Prescription not found" });
  res.json(prescription.toJSON());
}));

// PATCH /api/prescriptions/:id/payment - record how the consultation fee was paid
router.patch("/:id/payment", authMiddleware, asyncHandler(async (req, res) => {
  const { mode, reference } = req.body;
  if (!["Cash", "GPay"].includes(mode)) {
    return res.status(400).json({ error: "mode must be Cash or GPay" });
  }

  const prescription = await Prescription.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!prescription) return res.status(404).json({ error: "Prescription not found" });

  prescription.payment = {
    status: "paid",
    mode,
    reference: mode === "GPay" ? (reference || "") : "",
    paidAt: new Date()
  };

  await prescription.save();
  res.json(prescription.toJSON());
}));

// PATCH /api/prescriptions/:id/payment/reset - revert a mis-recorded payment back to pending
router.patch("/:id/payment/reset", authMiddleware, asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!prescription) return res.status(404).json({ error: "Prescription not found" });

  prescription.payment = { status: "pending", mode: null, reference: "", paidAt: null };
  await prescription.save();
  res.json(prescription.toJSON());
}));

// DELETE /api/prescriptions/:id
router.delete("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOneAndDelete({ _id: req.params.id, doctorId: req.doctorId });
  if (!prescription) return res.status(404).json({ error: "Prescription not found" });
  res.json({ deleted: true, id: prescription.id });
}));

// GET /api/prescriptions/:id/pdf - generate & download the prescription PDF
router.get("/:id/pdf", authMiddleware, asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOne({ _id: req.params.id, doctorId: req.doctorId });
  if (!prescription) return res.status(404).json({ error: "Prescription not found" });

  const doctor = await Doctor.findById(prescription.doctorId);

  try {
    const { pdfBytes } = await generatePrescriptionPdf(prescription.toJSON(), doctor.toJSON());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${prescription.prescriptionNumber}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}));

module.exports = router;
