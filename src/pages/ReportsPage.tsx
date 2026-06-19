import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { formatCurrency, formatDate, formatMonthLabel } from "../lib/format";
import type { Expense, PaymentRecord, Tenant } from "../types";

interface ReportsPageProps {
  tenants: Tenant[];
  payments: PaymentRecord[];
  setPayments: Dispatch<SetStateAction<PaymentRecord[]>>;
  expenses: Expense[];
  selectedYear: number;
  showAllYears: boolean;
  theme: "dark" | "paperwhite";
}

export function ReportsPage({ tenants, payments, setPayments, expenses, selectedYear, showAllYears, theme }: ReportsPageProps) {
  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const isDark = theme === "dark";
  const activeTenantCount = tenants.filter((tenant) => tenant.status === "active").length;

  const statusRowClassName: Record<PaymentRecord["status"], string> = {
    paid: isDark ? "bg-emerald-500/10 text-emerald-200" : "bg-emerald-100 text-emerald-800",
    partial: isDark ? "bg-amber-500/10 text-amber-200" : "bg-amber-100 text-amber-800",
    unpaid: isDark ? "bg-rose-500/10 text-rose-200" : "bg-rose-100 text-rose-800",
  };

  const paymentsForYear = useMemo(
    () =>
      showAllYears ? payments : payments.filter((payment) => Number(payment.month.slice(0, 4)) === selectedYear),
    [payments, selectedYear, showAllYears],
  );

  const expensesForYear = useMemo(
    () =>
      showAllYears ? expenses : expenses.filter((expense) => new Date(expense.date).getFullYear() === selectedYear),
    [expenses, selectedYear, showAllYears],
  );

  const totalCollections = useMemo(
    () => paymentsForYear.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0),
    [paymentsForYear],
  );

  const totalExpenses = useMemo(
    () => expensesForYear.reduce((sum, expense) => sum + expense.amount, 0),
    [expensesForYear],
  );

  const paidCollectionCount = paymentsForYear.filter((payment) => payment.status === "paid").length;
  const unpaidCollectionCount = paymentsForYear.filter((payment) => payment.status === "unpaid").length;
  const outgoingTransactionCount = expensesForYear.length;
  const [expandedCollectionMonths, setExpandedCollectionMonths] = useState<Record<string, boolean>>({});
  const [expandedExpenseMonths, setExpandedExpenseMonths] = useState<Record<string, boolean>>({});

  const sortedPaymentHistory = [...paymentsForYear].sort((a, b) => {
    const tenantA = (tenantNameById.get(a.tenantId) ?? "Unknown").toLowerCase();
    const tenantB = (tenantNameById.get(b.tenantId) ?? "Unknown").toLowerCase();

    if (tenantA !== tenantB) {
      return tenantA.localeCompare(tenantB);
    }

    // Keep the most recent transaction first inside each tenant group.
    if (a.month !== b.month) {
      return b.month.localeCompare(a.month);
    }

    const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : Number.NEGATIVE_INFINITY;
    const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : Number.NEGATIVE_INFINITY;
    if (dateA !== dateB) {
      return dateB - dateA;
    }

    // Final tie-breaker keeps ordering stable for equal month/date rows.
    return String(b.id).localeCompare(String(a.id));
  });

  const monthlyCollections = Array.from(new Set(paymentsForYear.map((payment) => payment.month)))
    .sort()
    .map((month) => {
      const paidRows = paymentsForYear.filter((payment) => payment.month === month && payment.status === "paid");
      const total = paidRows.reduce((sum, row) => sum + row.amount, 0);
      return {
        month,
        total,
        items: paidRows.map((row) => ({
          id: row.id,
          tenant: tenantNameById.get(row.tenantId) ?? "Unknown",
          amount: row.amount,
        })),
      };
    })
    .filter((group) => group.total > 0);

  const monthlyExpenseGroups = Array.from(new Set(expensesForYear.map((expense) => expense.date.slice(0, 7))))
    .sort()
    .map((month) => {
      const rows = expensesForYear.filter((expense) => expense.date.slice(0, 7) === month);
      return {
        month,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          amount: row.amount,
        })),
      };
    });

  const deleteMatchingCollectionRows = (targetPayment: PaymentRecord) => {
    setPayments((prev) =>
      prev.filter((row) => {
        const isSameDataRow =
          row.tenantId === targetPayment.tenantId &&
          row.month === targetPayment.month &&
          row.amount === targetPayment.amount &&
          row.status === targetPayment.status &&
          (row.paymentDate ?? "") === (targetPayment.paymentDate ?? "") &&
          row.referenceNo === targetPayment.referenceNo &&
          row.notes === targetPayment.notes;

        return !isSameDataRow;
      }),
    );
  };

  const renderCollapseIcon = (isOpen: boolean) => (
    <span
      className={
        isDark
          ? "inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200"
          : "inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-stone-100 text-slate-700"
      }
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 20 20"
        className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );

  return (
    <div className="space-y-8">
      <section
        className={
          isDark
            ? "rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"
            : "rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700"
        }
      >
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-2 text-center">
          <span>Tenants: {activeTenantCount} active users</span>
          <span>Collections: {paidCollectionCount} paid | {unpaidCollectionCount} unpaid</span>
          <span>Outgoings: {outgoingTransactionCount} transactions</span>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div
          className={
            isDark ? "rounded-lg border border-slate-800 bg-slate-900/50 p-5" : "rounded-lg border border-stone-300 bg-white p-5"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Monthly Collections</h3>
              <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>Paid payments grouped by month</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={isDark ? "text-slate-400" : "text-slate-700"}>Total</span>
              <span
                className={
                  isDark
                    ? "rounded-md border border-sky-500/30 bg-sky-500/15 px-3 py-1 font-semibold text-sky-200"
                    : "rounded-md border border-sky-300 bg-sky-50 px-3 py-1 font-semibold text-sky-800"
                }
              >
                {formatCurrency(totalCollections)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {monthlyCollections.map((row) => {
              const isOpen = Boolean(expandedCollectionMonths[row.month]);
              return (
                <div key={row.month} className={isDark ? "border-b border-slate-800 pb-2" : "border-b border-stone-200 pb-2"}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCollectionMonths((prev) => ({
                        ...prev,
                        [row.month]: !prev[row.month],
                      }))
                    }
                    className={
                      isDark
                        ? "flex w-full items-center justify-between text-sm text-slate-100"
                        : "flex w-full items-center justify-between text-sm text-slate-800"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span>{formatMonthLabel(row.month)}</span>
                      {renderCollapseIcon(isOpen)}
                    </span>
                    <span className={isDark ? "font-medium text-slate-200" : "font-medium text-slate-700"}>
                      {formatCurrency(row.total)}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="mt-2 space-y-1 pl-6">
                      {row.items.map((entry) => (
                        <div
                          key={entry.id}
                          className={
                            isDark
                              ? "flex items-center justify-between text-sm text-slate-400"
                              : "flex items-center justify-between text-sm text-slate-600"
                          }
                        >
                          <span>{entry.tenant}</span>
                          <span>{formatCurrency(entry.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {monthlyCollections.length === 0 ? (
              <div className={isDark ? "text-sm text-slate-500" : "text-sm text-slate-500"}>No paid collections for this scope.</div>
            ) : null}
          </div>
        </div>

        <div
          className={
            isDark ? "rounded-lg border border-slate-800 bg-slate-900/50 p-5" : "rounded-lg border border-stone-300 bg-white p-5"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium">Expense Report</h3>
              <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>All operational expenses</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={isDark ? "text-slate-400" : "text-slate-700"}>Total</span>
              <span
                className={
                  isDark
                    ? "rounded-md border border-sky-500/30 bg-sky-500/15 px-3 py-1 font-semibold text-sky-200"
                    : "rounded-md border border-sky-300 bg-sky-50 px-3 py-1 font-semibold text-sky-800"
                }
              >
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {monthlyExpenseGroups.map((group) => {
              const isOpen = Boolean(expandedExpenseMonths[group.month]);
              return (
                <div key={group.month} className={isDark ? "border-b border-slate-800 pb-2" : "border-b border-stone-200 pb-2"}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedExpenseMonths((prev) => ({
                        ...prev,
                        [group.month]: !prev[group.month],
                      }))
                    }
                    className={
                      isDark
                        ? "flex w-full items-center justify-between text-sm text-slate-100"
                        : "flex w-full items-center justify-between text-sm text-slate-800"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span>{formatMonthLabel(group.month)}</span>
                      {renderCollapseIcon(isOpen)}
                    </span>
                    <span className={isDark ? "font-medium text-slate-200" : "font-medium text-slate-700"}>
                      {formatCurrency(group.total)}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="mt-2 space-y-1 pl-6">
                      {group.items.map((expense) => (
                        <div
                          key={expense.id}
                          className={
                            isDark
                              ? "flex items-center justify-between text-sm text-slate-400"
                              : "flex items-center justify-between text-sm text-slate-600"
                          }
                        >
                          <span>{expense.title}</span>
                          <span>{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {monthlyExpenseGroups.length === 0 ? (
              <div className={isDark ? "text-sm text-slate-500" : "text-sm text-slate-500"}>No outgoings for this scope.</div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className={
          isDark ? "rounded-lg border border-slate-800 bg-slate-900/50 p-5" : "rounded-lg border border-stone-300 bg-white p-5"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Tenant Collection History</h3>
            <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-600"}>Chronological payment records with status</p>
            <p className={isDark ? "mt-1 text-sm text-slate-300" : "mt-1 text-sm text-slate-700"}>Scope: {showAllYears ? "All years" : selectedYear}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={isDark ? "text-slate-400" : "text-slate-700"}>Total</span>
            <span
              className={
                isDark
                  ? "rounded-md border border-sky-500/30 bg-sky-500/15 px-3 py-1 font-semibold text-sky-200"
                  : "rounded-md border border-sky-300 bg-sky-50 px-3 py-1 font-semibold text-sky-800"
              }
            >
              {formatCurrency(totalCollections)}
            </span>
          </div>
        </div>
        <div className="mt-4 max-h-80 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className={isDark ? "text-slate-400" : "text-slate-700"}>
              <tr>
                <th className="pb-2">Tenant</th>
                <th className="pb-2">Month</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Payment Date</th>
                <th className="pb-2">Reference</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPaymentHistory.map((payment) => (
                <tr
                  key={payment.id}
                  className={`${isDark ? "border-t border-slate-800" : "border-t border-stone-200"} ${statusRowClassName[payment.status]}`}
                >
                  <td className="py-2">{tenantNameById.get(payment.tenantId) ?? "Unknown"}</td>
                  <td className="py-2">{formatMonthLabel(payment.month)}</td>
                  <td className="py-2">{formatCurrency(payment.amount)}</td>
                  <td className="py-2 capitalize">{payment.status}</td>
                  <td className="py-2">{formatDate(payment.paymentDate)}</td>
                  <td className="py-2">{payment.referenceNo || "-"}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMatchingCollectionRows(payment)}
                      className={
                        isDark
                          ? "rounded border border-rose-400 px-2 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/10"
                          : "rounded border border-rose-500 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}