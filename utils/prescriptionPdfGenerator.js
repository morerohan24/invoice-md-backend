const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/**
 * Renders a prescription into a PDF byte buffer, styled like a classic Rx pad:
 * clinic header, patient strip, an Rx symbol, a medicine table, advice, and
 * a signature line. Payment status is shown as a small footer stamp so a
 * printed copy also documents whether/how the consultation fee was paid.
 */
async function generatePrescriptionPdf(prescription, doctor) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 50;
  let y = 800;

  const draw = (text, opts = {}) => {
    page.drawText(String(text), {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 11,
      font: opts.font || (opts.bold ? bold : font),
      color: opts.color ?? rgb(0.1, 0.1, 0.1)
    });
    y -= opts.gap ?? 18;
  };

  // ---- Clinic / doctor header ----
  draw(doctor.name, { bold: true, size: 18, gap: 20 });
  const subHeader = [doctor.qualification, doctor.registrationNo ? `Reg. No: ${doctor.registrationNo}` : null]
    .filter(Boolean)
    .join("   |   ");
  if (subHeader) draw(subHeader, { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 14 });
  if (doctor.clinicName) draw(doctor.clinicName, { size: 11, bold: true, gap: 14 });
  if (doctor.clinicAddress) draw(doctor.clinicAddress, { size: 9.5, color: rgb(0.4, 0.4, 0.4), gap: 14 });
  if (doctor.phone) draw(`Phone: ${doctor.phone}`, { size: 9.5, color: rgb(0.4, 0.4, 0.4), gap: 14 });

  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1.2, color: rgb(0.15, 0.15, 0.15) });
  y -= 22;

  // ---- Patient strip ----
  const patientLine = [
    `Patient: ${prescription.patientName}`,
    prescription.patientAge ? `Age: ${prescription.patientAge}` : null,
    prescription.patientGender ? `Gender: ${prescription.patientGender}` : null
  ]
    .filter(Boolean)
    .join("     ");
  draw(patientLine, { size: 11, bold: true, gap: 16 });

  const dateLine = [
    `Date: ${new Date(prescription.date).toLocaleDateString("en-IN")}`,
    prescription.patientPhone ? `Phone: ${prescription.patientPhone}` : null
  ]
    .filter(Boolean)
    .join("     ");
  draw(dateLine, { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 20 });

  if (prescription.diagnosis) {
    draw("Diagnosis / Notes:", { bold: true, size: 10.5, gap: 14 });
    draw(prescription.diagnosis, { size: 10.5, gap: 20 });
  } else {
    y -= 8;
  }

  // ---- Rx symbol + medicine table ----
  y -= 10;
  page.drawText("R", { x: margin, y, size: 24, font: italic, color: rgb(0.1, 0.1, 0.4) });
  page.drawText("x", { x: margin + 15, y: y - 4, size: 13, font: italic, color: rgb(0.1, 0.1, 0.4) });
  y -= 4;

  const colX = { name: margin + 40, dose: 300, freq: 370, dur: 450 };
  page.drawText("Medicine", { x: colX.name, y, size: 10, font: bold });
  page.drawText("Dosage", { x: colX.dose, y, size: 10, font: bold });
  page.drawText("Frequency", { x: colX.freq, y, size: 10, font: bold });
  page.drawText("Duration", { x: colX.dur, y, size: 10, font: bold });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.75, 0.75, 0.75) });
  y -= 18;

  const medicines = prescription.medicines || [];
  for (const med of medicines) {
    page.drawText(med.name || "-", { x: colX.name, y, size: 10.5, font });
    page.drawText(med.dosage || "-", { x: colX.dose, y, size: 10.5, font });
    page.drawText(med.frequency || "-", { x: colX.freq, y, size: 10.5, font });
    page.drawText(med.duration || "-", { x: colX.dur, y, size: 10.5, font });
    y -= 16;
    if (med.instructions) {
      page.drawText(`   ${med.instructions}`, { x: colX.name, y, size: 9, font: italic, color: rgb(0.4, 0.4, 0.4) });
      y -= 16;
    }
  }

  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.85, 0.85, 0.85) });
  y -= 26;

  // ---- Advice / follow-up ----
  if (prescription.advice) {
    draw("Advice:", { bold: true, size: 10.5, gap: 14 });
    const words = prescription.advice.split(/\s+/);
    let line = "";
    const maxCharsPerLine = 95;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxCharsPerLine) {
        draw(line, { size: 10 });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) draw(line, { size: 10 });
    y -= 6;
  }

  if (prescription.followUpDate) {
    draw(`Follow-up: ${new Date(prescription.followUpDate).toLocaleDateString("en-IN")}`, { size: 10.5, bold: true, gap: 20 });
  }

  // ---- Signature ----
  const sigY = 130;
  page.drawText("_________________________", { x: 370, y: sigY + 16, size: 11, font });
  page.drawText("Signature", { x: 370, y: sigY, size: 9.5, font, color: rgb(0.4, 0.4, 0.4) });

  // ---- Payment footer stamp ----
  const feeText = `Consultation Fee: Rs. ${Number(prescription.consultationFee || 0).toFixed(2)}`;
  let paymentText = "Payment: Pending";
  if (prescription.payment && prescription.payment.status === "paid") {
    paymentText = `Payment: Paid via ${prescription.payment.mode}`;
    if (prescription.payment.mode === "GPay" && prescription.payment.reference) {
      paymentText += ` (Ref: ${prescription.payment.reference})`;
    }
  }
  page.drawText(feeText, { x: margin, y: 90, size: 10, font: bold });
  page.drawText(paymentText, {
    x: margin,
    y: 74,
    size: 10,
    font: bold,
    color: prescription.payment && prescription.payment.status === "paid" ? rgb(0.08, 0.55, 0.25) : rgb(0.7, 0.45, 0)
  });

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes };
}

module.exports = { generatePrescriptionPdf };
