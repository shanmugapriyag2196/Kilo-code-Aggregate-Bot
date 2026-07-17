// Extract invoice fields from raw PDF text.
// Tune regexes against your real invoice layout.

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}
function extractAmount(text) {
  const matches = [...text.matchAll(/(?:RS|INR|USD|\$|€|£)\s?([\d,]+(?:\.\d{2})?)/gi)];
  let best = null;
  let bestVal = -1;
  for (const m of matches) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(val) && val > bestVal) {
      bestVal = val;
      best = val;
    }
  }
  return best;
}
function extractDate(text) {
  const m =
    text.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/) ||
    text.match(/\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/) ||
    text.match(/\b([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b/);
  return m ? m[1].trim() : null;
}

export function extractInvoiceFields(text) {
  const vendor = firstMatch(text, /Vendor[:\s]+([^\n]{2,60})/i);
  const invoiceNo = firstMatch(text, /(?:Invoice\s*(?:No|Number|#)|Inv\s*[:#])[:\s]*([A-Za-z0-9\-/]{2,30})/i);
  const poNo = firstMatch(text, /(?:PO\s*(?:No|Number|#)|Purchase\s*Order)[:\s]*([A-Za-z0-9\-/]{2,30})/i);
  const cls = firstMatch(text, /Class[:\s]+([^\n]{2,40})/i);
  const item = firstMatch(text, /(?:Item|Description)[:\s]+([^\n]{2,60})/i);
  const invoiceDate = extractDate(text);
  const amount = extractAmount(text);

  const fields = { vendor, class: cls, invoiceNo, invoiceDate, amount, item, poNo };
  const present = Object.values(fields).filter(Boolean).length;
  const confidence = Math.min(1, present / 6);

  return {
    ...fields,
    extractionConfidence: confidence,
    needsReview: confidence < 0.6,
  };
}
