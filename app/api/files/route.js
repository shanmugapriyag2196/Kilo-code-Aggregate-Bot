import { NextResponse } from "next/server";
import { scanAndSync, getSyncedFiles } from "@/lib/filesync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sync = scanAndSync();
    const files = getSyncedFiles();
    return NextResponse.json({
      ok: sync.ok,
      error: sync.error || null,
      sourceDir: sync.sourceDir || null,
      added: sync.added || [],
      total: files.length,
      files,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e && e.message ? e.message : "sync failed",
      sourceDir: null,
      added: [],
      total: 0,
      files: [],
    });
  }
}
