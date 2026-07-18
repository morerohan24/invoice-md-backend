const express = require("express");

const Hospital = require("../models/Hospital");
const { authMiddleware } = require("../utils/authMiddleware");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

// Used when a doctor adds a hospital by name only, without configuring
// custom fields (the "just write the hospital name" flow in New Invoice).
const DEFAULT_FIELDS = [
  { key: "opdVisits", label: "No. of OPD Visits", type: "number", rate: 500 },
  { key: "emergencyCalls", label: "Emergency Calls", type: "number", rate: 800 },
  { key: "nightDuty", label: "Night Duty (days)", type: "number", rate: 1500 },
  { key: "procedureCharges", label: "Procedure Charges", type: "amount" },
  { key: "professionalFees", label: "Professional Fees", type: "amount" }
];

// GET /api/hospitals - list all templates (shared across every doctor)
router.get("/", authMiddleware, asyncHandler(async (req, res) => {
  const hospitals = await Hospital.find().sort({ createdAt: 1 });
  res.json(hospitals.map((h) => h.toJSON()));
}));

// GET /api/hospitals/:id
router.get("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  res.json(hospital.toJSON());
}));

// POST /api/hospitals - create a hospital template.
// `requiredFields`, `notes`/`description` are all optional: a doctor can add
// a hospital just by typing its name, and it falls back to a generic set of
// billable fields (OPD visits, on-call, procedure/professional fees, etc.).
router.post("/", authMiddleware, asyncHandler(async (req, res) => {
  const { name, requiredFields, requiresSignature, requiresGST, notes, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Hospital name is required" });
  }

  const fields = Array.isArray(requiredFields) && requiredFields.length > 0 ? requiredFields : DEFAULT_FIELDS;

  const hospital = await Hospital.create({
    name: name.trim(),
    requiredFields: fields,
    requiresSignature: !!requiresSignature,
    requiresGST: !!requiresGST,
    notes: (notes || description || "").trim(),
    createdBy: req.doctorId
  });

  res.status(201).json(hospital.toJSON());
}));

// PUT /api/hospitals/:id - edit a custom template
router.put("/:id", authMiddleware, asyncHandler(async (req, res) => {
  const editable = ["name", "requiredFields", "requiresSignature", "requiresGST", "notes"];
  const updates = {};
  for (const field of editable) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  res.json(hospital.toJSON());
}));

module.exports = router;
