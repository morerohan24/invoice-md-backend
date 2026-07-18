const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Doctor = require("../models/Doctor");
const { authMiddleware, JWT_SECRET } = require("../utils/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// POST /api/doctors/register
router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, qualification, registrationNo, pan, gst, bankDetails } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  const exists = await Doctor.findOne({ email: email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const doctor = await Doctor.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    qualification: qualification || "",
    registrationNo: registrationNo || "",
    pan: pan || "",
    gst: gst || "",
    bankDetails: bankDetails || ""
  });

  const token = jwt.sign({ doctorId: doctor.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, doctor: doctor.toJSON() });
}));

// POST /api/doctors/login
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // passwordHash has `select: false` on the schema, so it must be opted back in here
  const doctor = await Doctor.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!doctor) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, doctor.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ doctorId: doctor.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, doctor: doctor.toJSON() });
}));

// GET /api/doctors/me
router.get("/me", authMiddleware, asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.doctorId);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor.toJSON());
}));

// PUT /api/doctors/me
router.put("/me", authMiddleware, asyncHandler(async (req, res) => {
  const editable = [
    "name",
    "qualification",
    "registrationNo",
    "pan",
    "gst",
    "bankDetails",
    "signature",
    "clinicName",
    "clinicAddress",
    "defaultConsultationFee",
    "upiId"
  ];

  const updates = {};
  for (const field of editable) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const doctor = await Doctor.findByIdAndUpdate(req.doctorId, updates, { new: true, runValidators: true });
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor.toJSON());
}));

module.exports = router;
