import { useState } from "react";
import {
  exportExpensesToExcel,
  exportFullDatasetToExcel,
  exportPaymentsToExcel,
  exportTenantsToExcel,
  parseExcelFile,
  validateImportRows,
} from "../services/excel";
import { normalizeLeaseTypeInput } from "../lib/leaseType";
import type {
  ExpenseCategory,
  Expense,
  ImportHistoryEntry,
  ImportValidationResult,
  ParsedExcelImportData,
  PaymentRecord,
  Tenant,
  TenantPaymentTerm,
} from "../types";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";

interface ImportExportPageProps {
  tenants: Tenant[];
  payments: PaymentRecord[];
  expenses: Expense[];
  importHistory: ImportHistoryEntry[];
  setImportHistory: Dispatch<SetStateAction<ImportHistoryEntry[]>>;
  setTenants: Dispatch<SetStateAction<Tenant[]>>;
  setPayments: Dispatch<SetStateAction<PaymentRecord[]>>;
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
}

const emptyValidation: ImportValidationResult = {
  validRows: [],
  validExpenseRows: [],
  duplicateRowsInFile: [],
  duplicateRowsInSystem: [],
  duplicateExpenseRowsInFile: [],
  duplicateExpenseRowsInSystem: [],
  missingTenants: [],
  leaseTypeMismatches: [],
  invalidLeaseTypes: [],
  invalidDates: [],
  invalidAmounts: [],
  invalidExpenseCategories: [],
  invalidExpenseDates: [],
  invalidExpenseAmounts: [],
};

export function ImportExportPage({
  tenants,
  payments,
  expenses,
  importHistory,
  setImportHistory,
  setTenants,
  setPayments,
  setExpenses,
}: ImportExportPageProps) {
  const [validation, setValidation] = useState<ImportValidationResult>(emptyValidation);
  const [parsedData, setParsedData] = useState<ParsedExcelImportData>({ paymentRows: [], tenantRows: [], expenseRows: [] });
  const [busy, setBusy] = useState(false);
  const [hasChosenFile, setHasChosenFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  const toMonthTemplateLabel = (value: string) => {
    const [yearText, monthText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return value;
    }
    const shortMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
    return `${shortMonth}-${String(year).slice(-2)}`;
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setHasChosenFile(false);
      setSelectedFileName("");
      return;
    }
    setHasChosenFile(true);
    setSelectedFileName(selectedFile.name);
    setBusy(true);
    const parsedRows = await parseExcelFile(selectedFile);
    const result = validateImportRows(parsedRows.paymentRows, parsedRows.tenantRows, parsedRows.expenseRows, tenants, payments, expenses);
    setParsedData(parsedRows);
    setValidation(result);
    setBusy(false);
  };

  const commitValidRows = () => {
    const nowIso = new Date().toISOString();
    const toTenantKey = (name: string, leaseType: string) => `${name.trim().toLowerCase()}|${leaseType.trim().toLowerCase()}`;
    const tenantByKey = new Map(tenants.map((tenant) => [toTenantKey(tenant.name, tenant.leaseType), tenant]));

    const normalizeLease = (leaseType: string) => normalizeLeaseTypeInput(leaseType) || "House";
    const normalizeExpenseCategory = (value: string): ExpenseCategory => {
      const normalized = value.trim().toLowerCase();
      if (normalized === "renovation") {
        return "renovation";
      }
      if (normalized === "maintenance") {
        return "maintenance";
      }
      if (normalized === "bank_transaction") {
        return "bank_transaction";
      }
      if (normalized === "bank_savings" || normalized === "bank savings") {
        return "bank_savings";
      }
      return "misc";
    };
    const normalizePaymentTerm = (term: string): TenantPaymentTerm => {
      const value = term.trim().toLowerCase();
      if (value === "quarterly") {
        return "Quarterly";
      }
      if (value === "semi-annual" || value === "semi annual" || value === "semiannual") {
        return "Semi-Annual";
      }
      if (value === "annually" || value === "annual") {
        return "Annually";
      }
      return "Monthly";
    };

    const createdTenants: Tenant[] = [];
    let nextTenantId = Math.max(0, ...tenants.map((tenant) => tenant.id)) + 1;

    parsedData.tenantRows.forEach((row) => {
      const leaseType = normalizeLease(row.leaseType);
      const key = toTenantKey(row.tenantName, leaseType);
      if (tenantByKey.has(key)) {
        return;
      }
      const newTenant: Tenant = {
        id: nextTenantId,
        name: row.tenantName,
        lotNo: row.lotNo,
        leaseType,
        paymentTerm: normalizePaymentTerm(row.paymentTerm),
        dueDate: row.startingDate || nowIso.slice(0, 10),
        monthlyRate: row.monthlyRate > 0 ? row.monthlyRate : 0,
        status: "active",
        inactivePeriods: [],
        createdAt: nowIso,
      };
      nextTenantId += 1;
      createdTenants.push(newTenant);
      tenantByKey.set(key, newTenant);
    });

    validation.validRows.forEach((row) => {
      const leaseType = normalizeLease(row.leaseType);
      const key = toTenantKey(row.tenantName, leaseType);
      if (tenantByKey.has(key)) {
        return;
      }
      const newTenant: Tenant = {
        id: nextTenantId,
        name: row.tenantName,
        lotNo: "",
        leaseType,
        paymentTerm: "Monthly",
        dueDate: nowIso.slice(0, 10),
        monthlyRate: row.amount,
        status: "active",
        inactivePeriods: [],
        createdAt: nowIso,
      };
      nextTenantId += 1;
      createdTenants.push(newTenant);
      tenantByKey.set(key, newTenant);
    });

    if (createdTenants.length) {
      setTenants((prev) => [...prev, ...createdTenants]);
    }

    const normalizePaymentStatus = (value: string | undefined): PaymentRecord["status"] => {
      const normalized = (value ?? "").trim().toLowerCase();
      if (normalized === "paid") {
        return "paid";
      }
      if (normalized === "partial") {
        return "partial";
      }
      return "unpaid";
    };

    setPayments((prev) => {
      const indexed = new Map(prev.map((record) => [`${record.tenantId}-${record.month}`, record]));
      let sequence = 0;

      validation.validRows.forEach((row) => {
        const leaseType = normalizeLease(row.leaseType);
        const tenant = tenantByKey.get(toTenantKey(row.tenantName, leaseType));
        if (!tenant) {
          return;
        }

        const key = `${tenant.id}-${row.month}`;
        const existing = indexed.get(key);
        const resolvedStatus = normalizePaymentStatus(row.status);
        const resolvedPaymentDate = row.paymentDate || (resolvedStatus === "paid" ? nowIso.slice(0, 10) : null);

        if (existing) {
          indexed.set(key, {
            ...existing,
            amount: row.amount,
            status: resolvedStatus,
            paymentDate: resolvedPaymentDate,
            referenceNo: row.referenceNo ?? existing.referenceNo,
            notes: row.notes ?? existing.notes,
          });
          return;
        }

        sequence += 1;
        indexed.set(key, {
          id: Date.now() + sequence,
          tenantId: tenant.id,
          month: row.month,
          amount: row.amount,
          status: resolvedStatus,
          paymentDate: resolvedPaymentDate,
          referenceNo: row.referenceNo ?? "",
          notes: row.notes || `Imported from Excel${row.leaseType ? ` (${row.leaseType})` : ""}`,
          createdAt: nowIso,
        });
      });

      return Array.from(indexed.values());
    });

    const expenseRecords: Expense[] = validation.validExpenseRows.map((row, index) => ({
      id: Date.now() + index,
      title: row.title,
      category: normalizeExpenseCategory(row.category),
      amount: row.amount,
      date: row.date,
      notes: row.notes || "Imported from Excel",
      createdAt: nowIso,
    }));
    if (expenseRecords.length) {
      setExpenses((prev) => [...prev, ...expenseRecords]);
    }

    setImportHistory((prev) => [
      {
        id: Date.now(),
        batchName: `Batch ${prev.length + 1}`,
        fileName: selectedFileName || "Unknown file",
        tenantCount: createdTenants.length,
        collectionCount: validation.validRows.length,
        outgoingCount: validation.validExpenseRows.length,
        importedAt: nowIso,
      },
      ...prev,
    ]);

    setValidation(emptyValidation);
    setParsedData({ paymentRows: [], tenantRows: [], expenseRows: [] });
    setHasChosenFile(false);
    setSelectedFileName("");
  };

  const deleteImportHistoryRow = (id: number) => {
    setImportHistory((prev) => prev.filter((entry) => entry.id !== id));
  };

  const totalInvalidRows =
    validation.duplicateRowsInFile.length +
    validation.duplicateRowsInSystem.length +
    validation.leaseTypeMismatches.length +
    validation.invalidLeaseTypes.length +
    validation.invalidDates.length +
    validation.invalidAmounts.length +
    validation.duplicateExpenseRowsInFile.length +
    validation.duplicateExpenseRowsInSystem.length +
    validation.invalidExpenseCategories.length +
    validation.invalidExpenseDates.length +
    validation.invalidExpenseAmounts.length;

  const totalReadyRows = validation.validRows.length + validation.validExpenseRows.length;
  const hasValidAttachedFile = hasChosenFile && totalReadyRows > 0;
  const blockedCollectionRows = [...validation.duplicateRowsInFile, ...validation.duplicateRowsInSystem]
    .map((row) => ({
      ...row,
      reason: validation.duplicateRowsInFile.includes(row) ? "Duplicate in file" : "Duplicate existing record",
    }))
    .sort((a, b) => a.rowNumber - b.rowNumber);
  const blockedOutgoingRows = [...validation.duplicateExpenseRowsInFile, ...validation.duplicateExpenseRowsInSystem]
    .map((row) => ({
      ...row,
      reason: validation.duplicateExpenseRowsInFile.includes(row) ? "Duplicate in file" : "Duplicate existing record",
    }))
    .sort((a, b) => a.rowNumber - b.rowNumber);
  const statusItems = [
    { label: "Valid Rows", value: validation.validRows.length, tone: "text-emerald-300" },
    { label: "Valid Outgoings", value: validation.validExpenseRows.length, tone: "text-emerald-300" },
    { label: "Duplicates (File)", value: validation.duplicateRowsInFile.length, tone: "text-amber-300" },
    { label: "Duplicates (Existing)", value: validation.duplicateRowsInSystem.length, tone: "text-amber-300" },
    { label: "Outgoing Dupes (File)", value: validation.duplicateExpenseRowsInFile.length, tone: "text-amber-300" },
    { label: "Outgoing Dupes (Existing)", value: validation.duplicateExpenseRowsInSystem.length, tone: "text-amber-300" },
    { label: "Missing Tenants (Auto)", value: validation.missingTenants.length, tone: "text-amber-300" },
    { label: "Lease Mismatch", value: validation.leaseTypeMismatches.length, tone: "text-rose-300" },
    { label: "Invalid Lease", value: validation.invalidLeaseTypes.length, tone: "text-rose-300" },
    { label: "Invalid Dates", value: validation.invalidDates.length, tone: "text-rose-300" },
    { label: "Invalid Amounts", value: validation.invalidAmounts.length, tone: "text-rose-300" },
    { label: "Invalid Outgoing Date", value: validation.invalidExpenseDates.length, tone: "text-rose-300" },
    { label: "Invalid Outgoing Amount", value: validation.invalidExpenseAmounts.length, tone: "text-rose-300" },
  ].filter((item) => item.value > 0);

  const tenantCount = tenants.length;
  const exportButtonClass =
    "primary-action-btn w-full rounded-md border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400";

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="text-lg font-medium">Excel Import</h3>
        <p className="text-sm text-slate-400">
          Template supported: TENANTS, COLLECTIONS, and OUTGOINGS blocks in one workbook (even side-by-side in one sheet)
          or in separate sheets. Lease type can be inferred from tenant records. Validation checks duplicates, existing
          records, lease mismatch, invalid dates, and invalid amounts.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileChange}
          className="mt-4 block w-full rounded-md border border-slate-700 bg-slate-950 p-2"
        />
        {busy ? <p className="mt-3 text-sm text-slate-400">Parsing file...</p> : null}

        {statusItems.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            {statusItems.map((item) => (
              <StatusBlock key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No import stats yet.</p>
        )}

        <p className="mt-4 text-sm text-slate-400">
          Ready to import: {totalReadyRows} rows | Blocked rows: {totalInvalidRows}
        </p>

        <button
          onClick={commitValidRows}
          disabled={!totalReadyRows}
          className={`mt-4 rounded-md border px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed ${
            hasValidAttachedFile
              ? "primary-action-btn border-indigo-500 bg-indigo-500 hover:bg-indigo-400"
              : "border-slate-700 bg-slate-700 text-slate-100 hover:bg-slate-600"
          } ${!totalReadyRows ? "opacity-75" : ""}`}
        >
          Import Valid Rows
        </button>

        {validation.validRows.length ? (
          <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
            <p className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">Valid collections preview</p>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Lease Type</th>
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium">Payment Date</th>
                    <th className="px-3 py-2 font-medium">Reference No</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.validRows.slice(0, 50).map((row) => (
                    <tr key={`${row.rowNumber}-${row.tenantName}-${row.month}`} className="border-t border-slate-800">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.tenantName}</td>
                      <td className="px-3 py-2">{row.leaseType}</td>
                      <td className="px-3 py-2">{toMonthTemplateLabel(row.month)}</td>
                      <td className="px-3 py-2">{row.paymentDate || "-"}</td>
                      <td className="px-3 py-2">{row.referenceNo || "-"}</td>
                      <td className="px-3 py-2">{row.notes || "-"}</td>
                      <td className="px-3 py-2">{row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : "Unpaid"}</td>
                      <td className="px-3 py-2">{row.amount.toLocaleString("en-PH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {blockedCollectionRows.length ? (
          <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
            <p className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              Blocked duplicate rows (collections)
            </p>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Lease Type</th>
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedCollectionRows.slice(0, 50).map((row) => (
                    <tr
                      key={`blocked-${row.rowNumber}-${row.tenantName}-${row.month}`}
                      className="border-t border-slate-800 bg-slate-300/10 text-slate-400 opacity-60"
                    >
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.tenantName}</td>
                      <td className="px-3 py-2">{row.leaseType}</td>
                      <td className="px-3 py-2">{row.month}</td>
                      <td className="px-3 py-2">{row.amount.toLocaleString("en-PH")}</td>
                      <td className="px-3 py-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {validation.validExpenseRows.length ? (
          <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
            <p className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">Valid outgoing preview</p>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.validExpenseRows.slice(0, 50).map((row) => (
                    <tr key={`${row.rowNumber}-${row.title}-${row.date}`} className="border-t border-slate-800">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.category}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.amount.toLocaleString("en-PH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {blockedOutgoingRows.length ? (
          <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
            <p className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              Blocked duplicate rows (outgoings)
            </p>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedOutgoingRows.slice(0, 50).map((row) => (
                    <tr
                      key={`blocked-outgoing-${row.rowNumber}-${row.title}-${row.date}`}
                      className="border-t border-slate-800 bg-slate-300/10 text-slate-400 opacity-60"
                    >
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.category}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.amount.toLocaleString("en-PH")}</td>
                      <td className="px-3 py-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-md border border-slate-800">
          <p className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">Import history</p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Batch</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Tenants</th>
                  <th className="px-3 py-2 font-medium">Collections</th>
                  <th className="px-3 py-2 font-medium">Outgoings</th>
                  <th className="px-3 py-2 font-medium">Imported At</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length ? (
                  importHistory.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{entry.batchName}</td>
                      <td className="px-3 py-2">{entry.fileName}</td>
                      <td className="px-3 py-2">{entry.tenantCount}</td>
                      <td className="px-3 py-2">{entry.collectionCount}</td>
                      <td className="px-3 py-2">{entry.outgoingCount}</td>
                      <td className="px-3 py-2">{new Date(entry.importedAt).toLocaleString("en-PH")}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => deleteImportHistoryRow(entry.id)}
                          className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-800">
                    <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                      No import history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-950/45 p-5">
        <h3 className="text-lg font-medium">Excel Export</h3>
        <p className="text-sm text-slate-400">Download the current table data as collections, outgoings, or full dataset.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Tenants: {tenantCount}</p>
            <button type="button" onClick={() => exportTenantsToExcel(tenants)} className={exportButtonClass}>
              Export Tenants
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Collections: {payments.length}</p>
            <button type="button" onClick={() => exportPaymentsToExcel(payments, tenants)} className={exportButtonClass}>
              Export Collections
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Outgoings: {expenses.length}</p>
            <button type="button" onClick={() => exportExpensesToExcel(expenses)} className={exportButtonClass}>
              Export Outgoings
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Full dataset: Tenants, Collections, Outgoings</p>
            <button
              type="button"
              onClick={() => exportFullDatasetToExcel(tenants, payments, expenses)}
              className={exportButtonClass}
            >
              Export Full Dataset
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

function StatusBlock({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}