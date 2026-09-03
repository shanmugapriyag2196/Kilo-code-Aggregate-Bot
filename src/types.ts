export type ManagerApproval = "Yes" | "No" | "Done";
export type BuyerApproval = "Verified" | "Not Verified" | "Completed";
export type QuickBooksStatus = "Not Ready" | "Ready" | "Loaded" | "Completed";
export type PdfExtractionStatus = "Pending" | "Processing" | "Completed";
export type ExcelProcessingStatus = "Pending" | "Processing" | "Completed";
export type JsonExtractionStatus = "Pending" | "Processing" | "Completed";
export type ProcessStepState = "Pending" | "Processing" | "Completed";

export interface Invoice {
  id: string;
  fileName: string;
  vendor: string;
  klass: string;
  invoiceDate: string; // ISO date
  invoiceNumber: string;
  amount: number;
  itemDescription: string;
  poNumber: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  accountNumber: string | null;
  invoicePath: string;
  managerApproval: ManagerApproval;
  buyerApproval: BuyerApproval;
  quickBooksStatus: QuickBooksStatus;
  pdfExtraction: PdfExtractionStatus;
  jsonExtraction: JsonExtractionStatus;
  excelProcessing: ExcelProcessingStatus;
}

export interface Buyer {
  name: string;
  email: string;
}
