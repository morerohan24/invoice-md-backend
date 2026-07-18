const Hospital = require("../models/Hospital");

const DEFAULT_HOSPITALS = [
  {
    name: "Apollo Hospital",
    requiredFields: [
      { key: "opdVisits", label: "No. of OPD Visits", type: "number", rate: 500 },
      { key: "emergencyCalls", label: "Emergency Calls", type: "number", rate: 800 },
      { key: "nightDuty", label: "Night Duty (days)", type: "number", rate: 1500 },
      { key: "icuCharges", label: "ICU Charges", type: "amount" },
      { key: "procedureCharges", label: "Procedure Charges", type: "amount" }
    ],
    requiresSignature: true,
    requiresGST: true,
    notes: "Requires digital signature and GSTIN on every invoice."
  },
  {
    name: "Ruby Hall Clinic",
    requiredFields: [
      { key: "opdVisits", label: "No. of OPD Visits", type: "number", rate: 450 },
      { key: "professionalFees", label: "Professional Fees", type: "amount" },
      { key: "procedureCharges", label: "Procedure Charges", type: "amount" }
    ],
    requiresSignature: true,
    requiresGST: false,
    notes: "PAN mandatory. GST optional for consultants below threshold."
  },
  {
    name: "ONGC Hospital",
    requiredFields: [
      { key: "opdVisits", label: "No. of OPD Visits", type: "number", rate: 400 },
      { key: "nightDuty", label: "Night Duty (days)", type: "number", rate: 1200 }
    ],
    requiresSignature: false,
    requiresGST: false,
    notes: "Government empanelment number required in doctor profile."
  }
];

async function seedHospitals() {
  const count = await Hospital.countDocuments();
  if (count > 0) return;
  await Hospital.insertMany(DEFAULT_HOSPITALS);
  console.log(`Seeded ${DEFAULT_HOSPITALS.length} default hospital templates`);
}

module.exports = { seedHospitals };
