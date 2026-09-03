import type { Invoice } from "../types";

export const PROCESS_STEPS = [
  "Outlook Mail",
  "PDF Attachment",
  "Save Attachment",
  "Rename File",
  "Python PDF Extraction",
  "Input.json",
  "Python Data Extraction",
  "Output.json",
  "Excel",
  "PO Number Check",
  "CenPoint",
  "Buyer Name",
  "Aggregate Web Application",
  "Buyer Approval",
  "Manager Approval",
  "Excel Export",
  "QuickBooks Online",
  "Manager Approval = Done",
  "Completed",
] as const;

export type ProcessStep = (typeof PROCESS_STEPS)[number];

export function stepIndexForInvoice(inv: Invoice): number {
  // No PO => stopped at step 9 (PO Number Check), since buyer lookup is skipped.
  if (!inv.poNumber) {
    // Even without PO, manager may still be "No" (e.g. utility invoice).
    if (inv.managerApproval === "No") return 9; // PO Number Check
    return 9;
  }
  // With PO, the deepest completed step is governed by manager/buyer/QB state.
  if (inv.quickBooksStatus === "Completed" && inv.managerApproval === "Done") return 18; // Completed
  if (inv.quickBooksStatus === "Completed") return 17; // Manager Approval = Done (just before)
  if (inv.quickBooksStatus === "Loaded") return 16; // QuickBooks Online (loaded, awaiting Done)
  if (inv.quickBooksStatus === "Ready") return 15; // Excel Export
  if (inv.buyerApproval === "Completed" || inv.buyerApproval === "Verified") return 14; // Manager Approval
  return 13; // Buyer Approval (still pending)
}

export function overallStatus(inv: Invoice): string {
  if (inv.quickBooksStatus === "Completed" && inv.managerApproval === "Done") return "Completed";
  if (inv.quickBooksStatus === "Loaded") return "Loaded into QuickBooks";
  if (inv.quickBooksStatus === "Ready") return "Ready for QuickBooks";
  if (inv.managerApproval === "Done") return "Manager Approved (Done)";
  if (inv.buyerApproval === "Not Verified" && inv.poNumber && inv.managerApproval === "Yes")
    return "Buyer Approval Pending";
  if (!inv.poNumber) return "PO Number Not Available";
  if (inv.managerApproval === "No") return "Pending Manager Review";
  return "In Progress";
}
