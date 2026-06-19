export type TenantStatus = "active" | "inactive";

export type TenantLeaseType = "House" | "Lot" | "Parking Car" | "Parking Motor";

export type TenantPaymentTerm = "Monthly" | "Quarterly" | "Semi-Annual" | "Annually";

export interface InactivePeriod {
  startDate: string;
  endDate?: string;
}

export interface Tenant {
  id: number;
  name: string;
  lotNo: string;
  leaseType: TenantLeaseType;
  paymentTerm: TenantPaymentTerm;
  dueDate: string;
  monthlyRate: number;
  status: TenantStatus;
  inactivePeriods: InactivePeriod[];
  createdAt: string;
}

export type PaymentStatus = "paid" | "unpaid" | "partial";

export interface PaymentRecord {
  id: number;
  tenantId: number;
  month: string;
  amount: number;
  status: PaymentStatus;
  paymentDate: string | null;
  referenceNo: string;
  notes: string;
  createdAt: string;
}

export type ExpenseCategory = "renovation" | "maintenance" | "misc" | "bank_transaction" | "bank_savings";

export interface Expense {
  id: number;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
}

export interface ParsedImportRow {
  rowNumber: number;
  tenantName: string;
  leaseType: string;
  amount: number;
  month: string;
  status?: string;
  paymentDate?: string;
  referenceNo?: string;
  notes?: string;
}

export interface ParsedTenantImportRow {
  rowNumber: number;
  tenantName: string;
  leaseType: string;
  paymentTerm: string;
  startingDate: string;
  monthlyRate: number;
  lotNo: string;
}

export interface ParsedExcelImportData {
  paymentRows: ParsedImportRow[];
  tenantRows: ParsedTenantImportRow[];
  expenseRows: ParsedExpenseImportRow[];
}

export interface ParsedExpenseImportRow {
  rowNumber: number;
  title: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
}

export interface ImportValidationResult {
  validRows: ParsedImportRow[];
  validExpenseRows: ParsedExpenseImportRow[];
  duplicateRowsInFile: ParsedImportRow[];
  duplicateRowsInSystem: ParsedImportRow[];
  duplicateExpenseRowsInFile: ParsedExpenseImportRow[];
  duplicateExpenseRowsInSystem: ParsedExpenseImportRow[];
  missingTenants: ParsedImportRow[];
  leaseTypeMismatches: ParsedImportRow[];
  invalidLeaseTypes: ParsedImportRow[];
  invalidDates: ParsedImportRow[];
  invalidAmounts: ParsedImportRow[];
  invalidExpenseCategories: ParsedExpenseImportRow[];
  invalidExpenseDates: ParsedExpenseImportRow[];
  invalidExpenseAmounts: ParsedExpenseImportRow[];
}

export interface ImportHistoryEntry {
  id: number;
  batchName: string;
  fileName: string;
  tenantCount: number;
  collectionCount: number;
  outgoingCount: number;
  importedAt: string;
}