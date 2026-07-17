import crypto from "crypto";
import db, { savePdf, getSetting, setSetting, loadTokens } from "./db";
import {
  getValidToken,
  getMessage,
  getPdfAttachments,
  downloadAttachment,
  getMyEmail,
  sendReminderEmail,
} from "./graph";
import { extractInvoiceFields } from "./extract";
import { resolveBuyer } from "./buyer";

function deriveStage(rec) {
  if (rec.needsReview) return "INBOX";
  if (!rec.buyerName) return "EXTRACTED";
  if (rec.buyerApproval !== "Completed") return "MATCHED";
  if (rec.managerApproval === "Pending" || rec.managerApproval === "Yes") return "PENDING_MANAGER";
  if (rec.managerApproval === "Done") return "DONE";
  return "MATCHED";
}

function genId() {
  return crypto.randomUUID();
}

export async function processEmail(messageId) {
  const token = await getValidToken();
  if (!token) throw new Error("NO_TOKEN");

  const existing = db
    .prepare(`SELECT id FROM invoices WHERE email_id = ?`)
    .get(messageId);
  if (existing) return { skipped: true };

  const msg = await getMessage(token, messageId);
  const attachments = await getPdfAttachments(token, messageId);
  if (attachments.length === 0) return { skipped: true, reason: "no-pdf" };

  const att = attachments[0];
  const pdfBuf = await downloadAttachment(token, messageId, att.id);
  const pdfPath = savePdf(att.name || "invoice.pdf", pdfBuf);

  // Extract text from PDF
  let text = "";
  try {
    const mod = await import("pdf-parse");
    const pdfParse = mod.default || mod;
    text = (await pdfParse(pdfBuf)).text || "";
  } catch (e) {
    console.error("PDF_TEXT_EXTRACT_FAILED:", e.message);
  }
  const fields = extractInvoiceFields(text);
  const buyerName = await resolveBuyer(fields.invoiceNo, fields.vendor);

  const rec = {
    id: genId(),
    emailId: messageId,
    receivedAt: msg.receivedDateTime,
    pdfPath,
    pdfName: att.name,
    vendor: fields.vendor,
    class: fields.class,
    invoiceNo: fields.invoiceNo,
    invoiceDate: fields.invoiceDate,
    amount: fields.amount,
    item: fields.item,
    poNo: fields.poNo,
    buyerName,
    extractionConfidence: fields.extractionConfidence,
    needsReview: fields.needsReview ? 1 : 0,
  };
  rec.stage = deriveStage(rec);

  db.prepare(
    `INSERT INTO invoices
      (id, email_id, received_at, pdf_path, pdf_name, vendor, class, invoice_no, invoice_date, amount, item, po_no, buyer_name, extraction_confidence, needs_review, stage)
     VALUES (@id,@emailId,@receivedAt,@pdfPath,@pdfName,@vendor,@class,@invoiceNo,@invoiceDate,@amount,@item,@poNo,@buyerName,@extractionConfidence,@needsReview,@stage)`
  ).run(rec);

  // Email reminder on new invoice
  try {
    const me = await getMyEmail();
    if (me) {
      await sendReminderEmail(
        me,
        "New invoice email received",
        `New invoice PDF from ${msg.sender?.emailAddress?.address || "unknown"}.\nInvoice No: ${rec.invoiceNo || "n/a"}\nVendor: ${rec.vendor || "n/a"}\nAmount: ${rec.amount ?? "n/a"}\nNeeds review: ${!!rec.needsReview}`
      );
    }
  } catch {
    /* best effort */
  }

  return { created: true, invoiceNo: rec.invoiceNo, stage: rec.stage };
}
