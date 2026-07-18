const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/**
 * Renders an invoice into a PDF byte buffer.
 * @param {object} invoice - invoice record
 * @param {object} doctor - doctor profile
 * @param {object} hospital - hospital template
 */
async function generateInvoicePdf(invoice, doctor, hospital) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 800;
  const lineHeight = 18;

  const draw = (text, opts = {}) => {
    page.drawText(String(text), {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? bold : font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1)
    });
    y -= opts.gap ?? lineHeight;
  };

  // Header
  draw("PROFESSIONAL INVOICE", { bold: true, size: 18, gap: 26 });
  draw(`Invoice No: ${invoice.invoiceNumber}`, { size: 11 });
  draw(`Date: ${new Date(invoice.createdAt).toLocaleDateString("en-IN")}`, { size: 11 });
  draw(`Billing Month: ${invoice.month}`, { size: 11, gap: 26 });

  // Hospital block
  draw("Billed To:", { bold: true, gap: 16 });
  draw(hospital.name, { size: 12, gap: 26 });

  // Doctor block
  draw("From:", { bold: true, gap: 16 });
  draw(doctor.name, { size: 12 });
  if (doctor.qualification) draw(doctor.qualification, { size: 10 });
  if (doctor.registrationNo) draw(`Registration No: ${doctor.registrationNo}`, { size: 10 });
  if (doctor.pan) draw(`PAN: ${doctor.pan}`, { size: 10 });
  if (hospital.requiresGST && doctor.gst) draw(`GSTIN: ${doctor.gst}`, { size: 10 });
  y -= 10;

  // Optional description / note (wrapped to fit the page width)
  if (invoice.description) {
    draw("Description:", { bold: true, size: 10 });
    const words = invoice.description.split(/\s+/);
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
    y -= 10;
  }

  // Table header
  draw("Description", { bold: true, x: margin });
  page.drawText("Amount (INR)", {
    x: 420,
    y: y + lineHeight,
    size: 11,
    font: bold
  });
  y -= 4;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 16;

  let total = 0;
  for (const item of invoice.lineItems) {
    page.drawText(item.label, { x: margin, y, size: 10.5, font });
    page.drawText(item.amount.toFixed(2), { x: 460, y, size: 10.5, font });
    total += item.amount;
    y -= lineHeight;
  }

  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 20;

  draw("TOTAL", { bold: true, x: margin, gap: 0 });
  page.drawText(`INR ${total.toFixed(2)}`, {
    x: 440,
    y,
    size: 13,
    font: bold
  });
  y -= 40;

  // Bank details
  if (doctor.bankDetails) {
    draw("Payment Details:", { bold: true, size: 11 });
    draw(doctor.bankDetails, { size: 10, gap: 30 });
  }

  // Signature
  if (hospital.requiresSignature) {
    y -= 20;
    draw("Signature: ____________________", { size: 11 });
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, total };
}

module.exports = { generateInvoicePdf };
