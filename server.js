require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { connectDB } = require("./config/db");
const { seedHospitals } = require("./config/seed");

const doctorRoutes = require("./routes/doctors");
const hospitalRoutes = require("./routes/hospitals");
const invoiceRoutes = require("./routes/invoices");
const prescriptionRoutes = require("./routes/prescriptions");

const app = express();

app.use(cors());
app.use(bodyParser.json());

let initialized = false;

async function initialize() {
  if (initialized) return;

  await connectDB();
  await seedHospitals();

  initialized = true;
}

// Initialize database before handling the first request
app.use(async (req, res, next) => {
  try {
    await initialize();
    next();
  } catch (err) {
    next(err);
  }
});

// API Routes
app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// Serve frontend only in local development
if (!process.env.VERCEL) {
  const frontendPath = path.join(__dirname, "..", "frontend");

  app.use(express.static(frontendPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
    });
  }

  if (err.name === "CastError") {
    return res.status(404).json({
      error: "Not found",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "Duplicate record",
    });
  }

  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

// Run locally only
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  initialize()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Startup Error:", err);
      process.exit(1);
    });
}

module.exports = app;