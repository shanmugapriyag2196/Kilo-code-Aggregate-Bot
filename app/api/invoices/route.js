import { NextResponse } from "next/server";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const needsReview = url.searchParams.get("needsReview");
  let query = `SELECT * FROM invoices`;
  const clauses = [];
  const params = [];
  if (stage) {
    params.push(stage);
    clauses.push(`stage = ?`);
  }
  if (needsReview === "true") {
    clauses.push(`needs_review = 1`);
  }
  if (clauses.length) query += ` WHERE ` + clauses.join(" AND ");
  query += ` ORDER BY received_at DESC LIMIT 200`;
  const rows = db.prepare(query).all(...params);
  return NextResponse.json({ invoices: rows });
}

export async function PATCH(request) {
  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const allowed = [
    "vendor", "class", "invoice_no", "invoice_date", "amount", "item", "po_no",
    "buyer_name", "account_number", "buyer_approval", "manager_approval",
  ];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (f in fields) {
      params.push(fields[f]);
      sets.push(`${f} = ?`);
    }
  }
  if (sets.length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });
  params.push(id);
  db.prepare(`UPDATE invoices SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return NextResponse.json({ ok: true });
}
