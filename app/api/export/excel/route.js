import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM invoices WHERE id IN (${placeholders})`).all(...ids);

  if (rows.length === 0) {
    return NextResponse.json({ error: "no invoices found" }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");
  sheet.columns = [
    { header: "Vendor", key: "vendor", width: 25 },
    { header: "Class", key: "class", width: 15 },
    { header: "Invoice No", key: "invoice_no", width: 20 },
    { header: "Invoice Date", key: "invoice_date", width: 15 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Item", key: "item", width: 20 },
    { header: "PO No", key: "po_no", width: 15 },
    { header: "Buyer Name", key: "buyer_name", width: 20 },
    { header: "Account Number", key: "account_number", width: 20 },
    { header: "Buyer Approval", key: "buyer_approval", width: 15 },
    { header: "Manager Approval", key: "manager_approval", width: 18 },
    { header: "Invoice Path", key: "pdf_path", width: 40 },
  ];
  sheet.addRows(rows);

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=invoices-${new Date().toISOString().slice(0, 10)}.xlsx`,
    },
  });
}
