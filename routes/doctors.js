const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Doctor = require("../models/Doctor");
const { authMiddleware, JWT_SECRET } = require("../utils/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  isValidPAN,
  isValidGST,
  isValidUPI,
  isNonNegativeNumber,
  ValidationErrors
} = require("../utils/validators");

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// POST /api/doctors/register
router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, qualification, registrationNo, pan, gst, bankDetails } = req.body;

  const errors = new ValidationErrors();

  if (!isNonEmptyString(name)) {
    errors.add("name", "Name is required");
  }
  if (!isValidEmail(email)) {
    errors.add("email", "Enter a valid email address");
  }
  if (!isValidPassword(password, 8)) {
    errors.add("password", "Password must be at least 8 characters");
  }
  // confirmPassword is optional on the wire (the frontend also checks this before
  // submitting), but if it's sent, it must match.
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.add("confirmPassword", "Passwords do not match");
  }
  if (!isNonEmptyString(registrationNo)) {
    errors.add("registrationNo", "Medical registration number is required");
  }
  // PAN and GST are optional fields on the doctor profile, but if a value was
  // typed in, it must be in the correct format.
  if (isNonEmptyString(pan) && !isValidPAN(pan)) {
    errors.add("pan", "PAN must be in the format ABCDE1234F");
  }
  if (isNonEmptyString(gst) && !isValidGST(gst)) {
    errors.add("gst", "GSTIN must be a valid 15-character GST number");
  }

  if (errors.hasErrors) {
    return res.status(400).json(errors.toJSON());
  }

  const exists = await Doctor.findOne({ email: email.toLowerCase().trim() });
  if (exists) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const doctor = await Doctor.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    qualification: qualification || "",
    registrationNo: registrationNo.trim(),
    pan: pan ? pan.trim().toUpperCase() : "",
    gst: gst ? gst.trim().toUpperCase() : "",
    bankDetails: bankDetails || ""
  });

  const token = jwt.sign({ doctorId: doctor.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token, doctor: doctor.toJSON() });
}));

// POST /api/doctors/login
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const errors = new ValidationErrors();
  if (!isNonEmptyString(email)) errors.add("email", "Email is required");
  if (!isNonEmptyString(password)) errors.add("password", "Password is required");
  if (errors.hasErrors) {
    return res.status(400).json(errors.toJSON());
  }

  // passwordHash has `select: false` on the schema, so it must be opted back in here
  const doctor = await Doctor.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
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

  const errors = new ValidationErrors();

  if (req.body.name !== undefined && !isNonEmptyString(req.body.name)) {
    errors.add("name", "Name is required");
  }
  if (req.body.pan !== undefined && isNonEmptyString(req.body.pan) && !isValidPAN(req.body.pan)) {
    errors.add("pan", "PAN must be in the format ABCDE1234F");
  }
  if (req.body.gst !== undefined && isNonEmptyString(req.body.gst) && !isValidGST(req.body.gst)) {
    errors.add("gst", "GSTIN must be a valid 15-character GST number");
  }
  if (req.body.upiId !== undefined && isNonEmptyString(req.body.upiId) && !isValidUPI(req.body.upiId)) {
    errors.add("upiId", "UPI ID must look like name@bank");
  }
  if (req.body.defaultConsultationFee !== undefined && req.body.defaultConsultationFee !== "" && !isNonNegativeNumber(req.body.defaultConsultationFee)) {
    errors.add("defaultConsultationFee", "Default consultation fee cannot be negative");
  }

  if (errors.hasErrors) {
    return res.status(400).json(errors.toJSON());
  }

  const updates = {};
  for (const field of editable) {
    if (req.body[field] === undefined) continue;
    if (field === "pan" || field === "gst") {
      updates[field] = req.body[field] ? String(req.body[field]).trim().toUpperCase() : "";
    } else if (field === "defaultConsultationFee") {
      updates[field] = req.body[field] === "" ? 0 : Number(req.body[field]);
    } else {
      updates[field] = req.body[field];
    }
  }

  const doctor = await Doctor.findByIdAndUpdate(req.doctorId, updates, { new: true, runValidators: true });
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  res.json(doctor.toJSON());
}));

module.exports = router;
