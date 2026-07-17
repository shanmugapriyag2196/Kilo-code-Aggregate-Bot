export async function resolveBuyer(invoiceNo, vendor) {
  const url = process.env.BUYER_ENDPOINT;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNo, vendor }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buyerName || data.buyer || data.name || null;
  } catch {
    return null;
  }
}
