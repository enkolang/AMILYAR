import * as XLSX from "xlsx";
import type {
  ExpenseCategory,
  Expense,
  ImportValidationResult,
  ParsedExcelImportData,
  ParsedExpenseImportRow,
  ParsedImportRow,
  ParsedTenantImportRow,
  PaymentRecord,
  Tenant,
  TenantLeaseType,
} from "../types";

function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  // Force .xlsx binary download through browser so it lands in Downloads.
  const workbookBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const workbookBlob = new Blob([workbookBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const objectUrl = URL.createObjectURL(workbookBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

const HEADER_ALIASES = {
  tenant: new Set(["tenantname", "tenant_name", "tenant", "tenantnam"]),
  title: new Set(["title", "expensetitle", "expense_title", "description", "particular", "name"]),
  category: new Set(["category", "expensecategory", "expense_category", "type"]),
  leaseType: new Set(["leasetype", "lease_type", "lease"]),
  amount: new Set(["amount", "monthlyrate", "monthlyrat", "monthly_rate", "rate"]),
  month: new Set(["month", "mont", "billingmonth"]),
  paymentDate: new Set(["paymentdate", "payment_date", "paymentdat", "date"]),
  referenceNo: new Set(["referenceno", "reference_no", "referencen", "orno", "or_no"]),
  status: new Set(["status", "paymentstatus"]),
  paymentTerm: new Set(["paymentterm", "payment_term", "term"]),
  startingDate: new Set(["startingdate", "starting_date", "startingdat", "startdate", "due_date", "duedate"]),
  lotNo: new Set(["lotno", "lot_no", "plateno", "plate_no"]),
  notes: new Set(["notes", "note", "remarks", "remark"]),
} as const;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function getColumnIndex(headers: string[], aliases: Set<string>): number {
  return headers.findIndex((header) => aliases.has(normalizeHeader(header)));
}

function hasKnownHeaderToken(value: string): boolean {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return false;
  }
  return Object.values(HEADER_ALIASES).some((aliases) => aliases.has(normalized));
}

function getNonEmptySegments(row: Array<string | number | Date | undefined>): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  let currentStart: number | null = null;

  row.forEach((value, index) => {
    const hasValue = String(value ?? "").trim().length > 0;
    if (hasValue && currentStart === null) {
      currentStart = index;
      return;
    }
    if (!hasValue && currentStart !== null) {
      segments.push({ start: currentStart, end: index - 1 });
      currentStart = null;
    }
  });

  if (currentStart !== null) {
    segments.push({ start: currentStart, end: row.length - 1 });
  }

  return segments;
}

interface HeaderBlock {
  type: "tenant" | "payment" | "expense";
  start: number;
  end: number;
  tenantIndex: number;
  amountIndex: number;
  monthIndex: number;
  leaseIndex: number;
  paymentDateIndex: number;
  referenceNoIndex: number;
  statusIndex: number;
  paymentTermIndex: number;
  startingDateIndex: number;
  lotNoIndex: number;
  titleIndex: number;
  categoryIndex: number;
  notesIndex: number;
}

function detectHeaderBlock(
  segmentHeaders: string[],
  segmentRange: { start: number; end: number },
  isOutgoingSheet: boolean
): HeaderBlock | null {
  const headerTokenCount = segmentHeaders.filter((header) => hasKnownHeaderToken(header)).length;
  if (headerTokenCount < 2) {
    return null;
  }

  const tenantIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.tenant);
  const amountIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.amount);
  const monthIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.month);
  const leaseIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.leaseType);
  const paymentDateIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.paymentDate);
  const referenceNoIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.referenceNo);
  const statusIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.status);
  const paymentTermIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.paymentTerm);
  const startingDateIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.startingDate);
  const lotNoIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.lotNo);
  const titleIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.title);
  const categoryIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.category);
  const notesIndex = getColumnIndex(segmentHeaders, HEADER_ALIASES.notes);

  const canParseTenantRows =
    tenantIndex >= 0 && leaseIndex >= 0 && (paymentTermIndex >= 0 || startingDateIndex >= 0 || amountIndex >= 0 || lotNoIndex >= 0);
  const hasExpenseTitleColumn = titleIndex >= 0 || (isOutgoingSheet && tenantIndex >= 0);
  const canParseExpenseRows = hasExpenseTitleColumn && amountIndex >= 0 && (paymentDateIndex >= 0 || monthIndex >= 0);
  const canParsePaymentRows = tenantIndex >= 0 && amountIndex >= 0 && (monthIndex >= 0 || paymentDateIndex >= 0);

  const hasTenantLayoutSignals = paymentTermIndex >= 0 || startingDateIndex >= 0 || lotNoIndex >= 0;
  const hasPaymentLayoutSignals = monthIndex >= 0 || statusIndex >= 0 || referenceNoIndex >= 0;

  // Expense blocks should be detected first for outgoing sheets and explicit expense-style columns.
  if (canParseExpenseRows && (isOutgoingSheet || (titleIndex >= 0 && categoryIndex >= 0))) {
    return {
      type: "expense",
      start: segmentRange.start,
      end: segmentRange.end,
      tenantIndex,
      amountIndex,
      monthIndex,
      leaseIndex,
      paymentDateIndex,
      referenceNoIndex,
      statusIndex,
      paymentTermIndex,
      startingDateIndex,
      lotNoIndex,
      titleIndex,
      categoryIndex,
      notesIndex,
    };
  }

  // COLLECTIONS-like blocks can contain lease+amount and would otherwise look like tenant rows.
  // If month/payment columns are present, treat the block as payment data.
  if (canParsePaymentRows && (hasPaymentLayoutSignals || !hasTenantLayoutSignals)) {
    return {
      type: "payment",
      start: segmentRange.start,
      end: segmentRange.end,
      tenantIndex,
      amountIndex,
      monthIndex,
      leaseIndex,
      paymentDateIndex,
      referenceNoIndex,
      statusIndex,
      paymentTermIndex,
      startingDateIndex,
      lotNoIndex,
      titleIndex,
      categoryIndex,
      notesIndex,
    };
  }

  if (canParseTenantRows) {
    return {
      type: "tenant",
      start: segmentRange.start,
      end: segmentRange.end,
      tenantIndex,
      amountIndex,
      monthIndex,
      leaseIndex,
      paymentDateIndex,
      referenceNoIndex,
      statusIndex,
      paymentTermIndex,
      startingDateIndex,
      lotNoIndex,
      titleIndex,
      categoryIndex,
      notesIndex,
    };
  }

  return null;
}

function toNormalizedMonth(value: string | number | Date | undefined): string | null {
  if (!value && value !== 0) {
    return null;
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}`;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const shortMonthMatch = trimmed.match(/^([a-zA-Z]{3})[-\s](\d{2}|\d{4})$/);
  if (shortMonthMatch) {
    const monthText = shortMonthMatch[1].toLowerCase();
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIndex = monthNames.indexOf(monthText);
    if (monthIndex >= 0) {
      const rawYear = shortMonthMatch[2];
      const year = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear);
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    }
  }
  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;
}

function toNormalizedDate(value: string | number | Date | undefined): string {
  if (!value && value !== 0) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return "";
    }
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const parsedDate = new Date(String(value).trim());
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }
  return parsedDate.toISOString().slice(0, 10);
}

function normalizeLeaseType(value: string): TenantLeaseType | "" {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "house" || normalized === "residential") {
    return "House";
  }
  if (normalized === "lot") {
    return "Lot";
  }
  if (normalized === "parking" || normalized === "parkingcar") {
    return "Parking Car";
  }
  if (normalized === "parkingmotor" || normalized === "motorparking" || normalized === "motor") {
    return "Parking Motor";
  }
  return "";
}

function normalizePaymentStatus(value: string): "paid" | "partial" | "unpaid" | "" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "paid") {
    return "paid";
  }
  if (normalized === "partial") {
    return "partial";
  }
  if (normalized === "unpaid") {
    return "unpaid";
  }
  return "";
}

function normalizePaymentTerm(value: string): "Monthly" | "Quarterly" | "Semi-Annual" | "Annually" {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "quarterly") {
    return "Quarterly";
  }
  if (normalized === "semiannual" || normalized === "semiannually") {
    return "Semi-Annual";
  }
  if (normalized === "annual" || normalized === "annually") {
    return "Annually";
  }
  return "Monthly";
}

function normalizeExpenseCategory(value: string): ExpenseCategory | "" {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "renovation") {
    return "renovation";
  }
  if (normalized === "maintenance") {
    return "maintenance";
  }
  if (normalized === "misc" || normalized === "miscellaneous") {
    return "misc";
  }
  if (normalized === "banktransaction" || normalized === "bank") {
    return "bank_transaction";
  }
  if (normalized === "banksavings" || normalized === "savings") {
    return "bank_savings";
  }
  return "";
}

export async function parseExcelFile(file: File): Promise<ParsedExcelImportData> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const paymentRows: ParsedImportRow[] = [];
  const tenantRows: ParsedTenantImportRow[] = [];
  const expenseRows: ParsedExpenseImportRow[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }
    const rawRows = XLSX.utils.sheet_to_json<Array<string | number | Date | undefined>>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (!rawRows.length) {
      return;
    }
    const normalizedSheetName = sheetName.trim().toLowerCase();
    const isOutgoingSheet = normalizedSheetName.includes("outgoing") || normalizedSheetName.includes("expense");

    rawRows.forEach((row, rowIndex) => {
      const segments = getNonEmptySegments(row);
      segments.forEach((segment) => {
        const segmentHeaders = row.slice(segment.start, segment.end + 1).map((cell) => String(cell ?? ""));
        const headerBlock = detectHeaderBlock(segmentHeaders, segment, isOutgoingSheet);
        if (!headerBlock) {
          return;
        }

        for (let dataRowIndex = rowIndex + 1; dataRowIndex < rawRows.length; dataRowIndex += 1) {
          const dataRow = rawRows[dataRowIndex] ?? [];
          const segmentValues = dataRow.slice(headerBlock.start, headerBlock.end + 1);
          const isSegmentBlank = segmentValues.every((cell) => String(cell ?? "").trim() === "");
          if (isSegmentBlank) {
            break;
          }

          const tenantName =
            headerBlock.tenantIndex >= 0
              ? String(dataRow[headerBlock.start + headerBlock.tenantIndex] ?? "").trim()
              : "";

          if (headerBlock.type === "tenant") {
            if (!tenantName) {
              continue;
            }
            const leaseType =
              headerBlock.leaseIndex >= 0
                ? normalizeLeaseType(String(dataRow[headerBlock.start + headerBlock.leaseIndex] ?? ""))
                : "";
            if (!leaseType) {
              continue;
            }
            const paymentTerm =
              headerBlock.paymentTermIndex >= 0
                ? normalizePaymentTerm(String(dataRow[headerBlock.start + headerBlock.paymentTermIndex] ?? ""))
                : "Monthly";
            const startingDate =
              headerBlock.startingDateIndex >= 0
                ? toNormalizedDate(
                    dataRow[headerBlock.start + headerBlock.startingDateIndex] as string | number | Date | undefined
                  )
                : "";
            const monthlyRate =
              headerBlock.amountIndex >= 0 ? Number(dataRow[headerBlock.start + headerBlock.amountIndex]) : 0;
            const lotNo =
              headerBlock.lotNoIndex >= 0 ? String(dataRow[headerBlock.start + headerBlock.lotNoIndex] ?? "").trim() : "";

            tenantRows.push({
              rowNumber: dataRowIndex + 1,
              tenantName,
              leaseType,
              paymentTerm,
              startingDate,
              monthlyRate: Number.isFinite(monthlyRate) ? monthlyRate : 0,
              lotNo,
            });
            continue;
          }

          if (headerBlock.type === "payment") {
            if (!tenantName) {
              continue;
            }
            const rawMonth =
              headerBlock.monthIndex >= 0
                ? dataRow[headerBlock.start + headerBlock.monthIndex]
                : dataRow[headerBlock.start + headerBlock.paymentDateIndex];
            const month = toNormalizedMonth(rawMonth as string | number | Date | undefined);
            const amount =
              headerBlock.amountIndex >= 0 ? Number(dataRow[headerBlock.start + headerBlock.amountIndex]) : Number.NaN;
            const leaseType =
              headerBlock.leaseIndex >= 0 ? String(dataRow[headerBlock.start + headerBlock.leaseIndex] ?? "").trim() : "";
            const paymentDate =
              headerBlock.paymentDateIndex >= 0
                ? toNormalizedDate(
                    dataRow[headerBlock.start + headerBlock.paymentDateIndex] as string | number | Date | undefined
                  )
                : "";
            const referenceNo =
              headerBlock.referenceNoIndex >= 0
                ? String(dataRow[headerBlock.start + headerBlock.referenceNoIndex] ?? "").trim()
                : "";
            const notes =
              headerBlock.notesIndex >= 0 ? String(dataRow[headerBlock.start + headerBlock.notesIndex] ?? "").trim() : "";
            const statusRaw =
              headerBlock.statusIndex >= 0 ? String(dataRow[headerBlock.start + headerBlock.statusIndex] ?? "").trim() : "";
            const status = normalizePaymentStatus(statusRaw);

            if (month || Number.isFinite(amount)) {
              paymentRows.push({
                rowNumber: dataRowIndex + 1,
                tenantName,
                leaseType,
                amount,
                month: month ?? "",
                paymentDate,
                referenceNo,
                notes,
                status,
              });
            }
            continue;
          }

          const title =
            headerBlock.titleIndex >= 0
              ? String(dataRow[headerBlock.start + headerBlock.titleIndex] ?? "").trim()
              : isOutgoingSheet
                ? tenantName
                : "";
          const dateValue =
            headerBlock.paymentDateIndex >= 0
              ? dataRow[headerBlock.start + headerBlock.paymentDateIndex]
              : dataRow[headerBlock.start + headerBlock.monthIndex];
          const date = toNormalizedDate(dateValue as string | number | Date | undefined);
          const monthFallback = toNormalizedMonth(dateValue as string | number | Date | undefined);
          const normalizedDate = date || (monthFallback ? `${monthFallback}-01` : "");
          const amount =
            headerBlock.amountIndex >= 0 ? Number(dataRow[headerBlock.start + headerBlock.amountIndex]) : Number.NaN;
          const categoryText =
            headerBlock.categoryIndex >= 0
              ? String(dataRow[headerBlock.start + headerBlock.categoryIndex] ?? "").trim()
              : "";
          const notes =
            headerBlock.notesIndex >= 0 ? String(dataRow[headerBlock.start + headerBlock.notesIndex] ?? "").trim() : "";

          if (title || Number.isFinite(amount) || normalizedDate) {
            expenseRows.push({
              rowNumber: dataRowIndex + 1,
              title,
              category: categoryText,
              amount,
              date: normalizedDate,
              notes,
            });
          }
        }
      });
    });
  });

  return { paymentRows, tenantRows, expenseRows };
}

export function validateImportRows(
  rows: ParsedImportRow[],
  tenantRows: ParsedTenantImportRow[],
  expenseRows: ParsedExpenseImportRow[],
  tenants: Tenant[],
  existingPayments: PaymentRecord[],
  existingExpenses: Expense[]
): ImportValidationResult {
  const knownTenantRowsByName = new Map<string, Array<{ leaseType: string; monthlyRate: number }>>();
  tenantRows.forEach((row) => {
    const key = row.tenantName.toLowerCase();
    const entries = knownTenantRowsByName.get(key) ?? [];
    entries.push({ leaseType: row.leaseType.toLowerCase(), monthlyRate: row.monthlyRate });
    knownTenantRowsByName.set(key, entries);
  });

  const knownTenantsByName = new Map<string, Array<{ id?: number; leaseType: string; monthlyRate: number }>>();
  tenants.forEach((tenant) => {
    const key = tenant.name.toLowerCase();
    const entries = knownTenantsByName.get(key) ?? [];
    entries.push({ id: tenant.id, leaseType: tenant.leaseType.toLowerCase(), monthlyRate: tenant.monthlyRate });
    knownTenantsByName.set(key, entries);
  });
  knownTenantRowsByName.forEach((entries, key) => {
    const known = knownTenantsByName.get(key) ?? [];
    entries.forEach((entry) => known.push({ leaseType: entry.leaseType, monthlyRate: entry.monthlyRate }));
    knownTenantsByName.set(key, known);
  });

  const existingKeys = new Set(existingPayments.map((payment) => `${payment.tenantId}-${payment.month}`));
  const tenantIdByNameAndLease = new Map(tenants.map((tenant) => [`${tenant.name.toLowerCase()}|${tenant.leaseType.toLowerCase()}`, tenant.id]));
  const seen = new Set<string>();

  const validRows: ParsedImportRow[] = [];
  const duplicateRowsInFile: ParsedImportRow[] = [];
  const duplicateRowsInSystem: ParsedImportRow[] = [];
  const missingTenants: ParsedImportRow[] = [];
  const leaseTypeMismatches: ParsedImportRow[] = [];
  const invalidLeaseTypes: ParsedImportRow[] = [];
  const invalidDates: ParsedImportRow[] = [];
  const invalidAmounts: ParsedImportRow[] = [];
  const validExpenseRows: ParsedExpenseImportRow[] = [];
  const duplicateExpenseRowsInFile: ParsedExpenseImportRow[] = [];
  const duplicateExpenseRowsInSystem: ParsedExpenseImportRow[] = [];
  const invalidExpenseCategories: ParsedExpenseImportRow[] = [];
  const invalidExpenseDates: ParsedExpenseImportRow[] = [];
  const invalidExpenseAmounts: ParsedExpenseImportRow[] = [];

  rows.forEach((row) => {
    if (!row.tenantName) {
      missingTenants.push(row);
      return;
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      invalidAmounts.push(row);
      return;
    }

    const nameKey = row.tenantName.toLowerCase();
    if (!/^\d{4}-\d{2}$/.test(row.month)) {
      invalidDates.push(row);
      return;
    }

    const normalizedLeaseType = normalizeLeaseType(row.leaseType).toLowerCase();
    if (row.leaseType && !normalizedLeaseType) {
      invalidLeaseTypes.push(row);
      return;
    }

    const candidates = knownTenantsByName.get(nameKey) ?? [];
    const matchingLeaseCandidates = normalizedLeaseType
      ? candidates.filter((candidate) => candidate.leaseType === normalizedLeaseType)
      : candidates;

    let resolvedLeaseType = normalizedLeaseType;
    if (!resolvedLeaseType && matchingLeaseCandidates.length === 1) {
      resolvedLeaseType = matchingLeaseCandidates[0].leaseType;
    }
    if (!resolvedLeaseType && matchingLeaseCandidates.length > 1) {
      const amountMatches = matchingLeaseCandidates.filter((candidate) => candidate.monthlyRate === row.amount);
      if (amountMatches.length === 1) {
        resolvedLeaseType = amountMatches[0].leaseType;
      }
    }
    if (!resolvedLeaseType && candidates.length) {
      resolvedLeaseType = candidates[0].leaseType;
    }

    const hasAnyTenantWithName = candidates.length > 0;
    const hasMatchingLease = resolvedLeaseType
      ? candidates.some((candidate) => candidate.leaseType === resolvedLeaseType)
      : hasAnyTenantWithName;

    if (!hasAnyTenantWithName || !hasMatchingLease) {
      missingTenants.push(row);
    }

    if (hasAnyTenantWithName && row.leaseType && !hasMatchingLease) {
      leaseTypeMismatches.push(row);
      return;
    }

    const resolvedLeaseTypeLabel = normalizeLeaseType(resolvedLeaseType) || normalizeLeaseType(row.leaseType);
    const resolvedRow: ParsedImportRow = {
      ...row,
      leaseType: resolvedLeaseTypeLabel || row.leaseType,
    };

    const key = `${nameKey}-${resolvedRow.leaseType.toLowerCase() || "unknown"}-${row.month}`;
    if (seen.has(key)) {
      duplicateRowsInFile.push(resolvedRow);
      return;
    }

    const tenantId = tenantIdByNameAndLease.get(`${nameKey}|${resolvedRow.leaseType.toLowerCase()}`);
    if (tenantId && existingKeys.has(`${tenantId}-${row.month}`)) {
      duplicateRowsInSystem.push(resolvedRow);
    }

    seen.add(key);
    validRows.push(resolvedRow);
  });

  const existingExpenseKeys = new Set(existingExpenses.map((expense) => `${expense.title.toLowerCase()}|${expense.date}|${expense.amount}`));
  const seenExpenseKeys = new Set<string>();

  expenseRows.forEach((row) => {
    const normalizedCategory = row.category ? normalizeExpenseCategory(row.category) : "misc";
    const resolvedCategory = normalizedCategory || "misc";

    if (row.category && !normalizedCategory) {
      invalidExpenseCategories.push(row);
      return;
    }
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      invalidExpenseAmounts.push(row);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      invalidExpenseDates.push(row);
      return;
    }
    const title = row.title.trim();
    if (!title) {
      invalidExpenseCategories.push(row);
      return;
    }

    const resolvedRow: ParsedExpenseImportRow = { ...row, title, category: resolvedCategory };
    const key = `${title.toLowerCase()}|${resolvedRow.date}|${resolvedRow.amount}|${resolvedCategory}`;
    if (seenExpenseKeys.has(key)) {
      duplicateExpenseRowsInFile.push(resolvedRow);
      return;
    }
    if (existingExpenseKeys.has(`${title.toLowerCase()}|${resolvedRow.date}|${resolvedRow.amount}`)) {
      duplicateExpenseRowsInSystem.push(resolvedRow);
      return;
    }

    seenExpenseKeys.add(key);
    validExpenseRows.push(resolvedRow);
  });

  return {
    validRows,
    validExpenseRows,
    duplicateRowsInFile,
    duplicateRowsInSystem,
    duplicateExpenseRowsInFile,
    duplicateExpenseRowsInSystem,
    missingTenants,
    leaseTypeMismatches,
    invalidLeaseTypes,
    invalidDates,
    invalidAmounts,
    invalidExpenseCategories,
    invalidExpenseDates,
    invalidExpenseAmounts,
  };
}

export function exportPaymentsToExcel(records: PaymentRecord[], tenants: Tenant[]): void {
  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const leaseMap = new Map(tenants.map((tenant) => [tenant.id, tenant.leaseType]));
  const rows = records.map((record) => ({
    tenant_name: tenantMap.get(record.tenantId) ?? "Unknown",
    lease_type: leaseMap.get(record.tenantId) ?? "",
    month: record.month,
    amount: record.amount,
    status: record.status,
    payment_date: record.paymentDate,
    reference_no: record.referenceNo,
    notes: record.notes,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Collections");
  downloadWorkbook(workbook, "collections-report.xlsx");
}

export function exportTenantsToExcel(records: Tenant[]): void {
  const rows = records.map((tenant) => ({
    name: tenant.name,
    lot_no: tenant.lotNo,
    lease_type: tenant.leaseType,
    payment_term: tenant.paymentTerm,
    starting_date: tenant.dueDate,
    monthly_rate: tenant.monthlyRate,
    status: tenant.status,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Tenants");
  downloadWorkbook(workbook, "tenants-report.xlsx");
}

export function exportExpensesToExcel(records: Expense[]): void {
  const rows = records.map((record) => ({
    title: record.title,
    category: record.category,
    amount: record.amount,
    date: record.date,
    notes: record.notes,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Outgoings");
  downloadWorkbook(workbook, "outgoings-report.xlsx");
}

export function exportFullDatasetToExcel(
  tenants: Tenant[],
  payments: PaymentRecord[],
  expenses: Expense[]
): void {
  const workbook = XLSX.utils.book_new();
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  const toMonthDisplay = (value: string): string => {
    const parts = value.split("-");
    if (parts.length !== 2) {
      return value;
    }
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return value;
    }
    const monthLabel = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1] ?? "";
    return monthLabel ? `${monthLabel}-${String(year).slice(-2)}` : value;
  };

  const toDisplayDate = (value: string | null): string => {
    if (!value) {
      return "";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}/${parsed.getFullYear()}`;
  };

  const tenantsHeader = [["Tenant_Name", "Lot No", "Lease Type", "Payment Term", "Starting Date", "Monthly Rate", "Action"]];
  const tenantRows = tenants.map((tenant) => [
    tenant.name,
    tenant.lotNo,
    tenant.leaseType,
    tenant.paymentTerm,
    toDisplayDate(tenant.dueDate),
    tenant.monthlyRate,
    tenant.status,
  ]);

  const collectionsHeader = [["Tenant_name", "Lease type", "Month", "Amount", "Payment Dat", "Reference No", "Notes", "Status"]];
  const collectionRows = payments.map((payment) => {
    const tenant = tenantById.get(payment.tenantId);
    return [
      tenant?.name ?? "Unknown",
      tenant?.leaseType ?? "",
      toMonthDisplay(payment.month),
      payment.amount,
      toDisplayDate(payment.paymentDate),
      payment.referenceNo,
      payment.notes,
      payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
    ];
  });

  const outgoingsHeader = [["Title", "Category", "Amount", "Date", "Notes"]];
  const outgoingRows = expenses.map((expense) => [
    expense.title,
    expense.category,
    expense.amount,
    toDisplayDate(expense.date),
    expense.notes,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(sheet, [["TENANTS"]], { origin: "A1" });
  XLSX.utils.sheet_add_aoa(sheet, [["Tenants terms and information"]], { origin: "A2" });
  XLSX.utils.sheet_add_aoa(sheet, tenantsHeader, { origin: "A4" });
  if (tenantRows.length) {
    XLSX.utils.sheet_add_aoa(sheet, tenantRows, { origin: "A5" });
  }

  XLSX.utils.sheet_add_aoa(sheet, [["COLLECTIONS"]], { origin: "J1" });
  XLSX.utils.sheet_add_aoa(sheet, [["Collections for the cover period"]], { origin: "J2" });
  XLSX.utils.sheet_add_aoa(sheet, collectionsHeader, { origin: "J4" });
  if (collectionRows.length) {
    XLSX.utils.sheet_add_aoa(sheet, collectionRows, { origin: "J5" });
  }

  XLSX.utils.sheet_add_aoa(sheet, [["OUTGOINGS"]], { origin: "T1" });
  XLSX.utils.sheet_add_aoa(sheet, [["Expenditure metrics"]], { origin: "T2" });
  XLSX.utils.sheet_add_aoa(sheet, outgoingsHeader, { origin: "T4" });
  if (outgoingRows.length) {
    XLSX.utils.sheet_add_aoa(sheet, outgoingRows, { origin: "T5" });
  }

  sheet["!cols"] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 13 },
    { wch: 12 },
    { wch: 10 },
    { wch: 2 },
    { wch: 2 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 13 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 2 },
    { wch: 2 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 13 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "Full Dataset");
  downloadWorkbook(workbook, "amilyar-full-dataset.xlsx");
}