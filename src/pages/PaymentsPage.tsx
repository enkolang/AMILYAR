import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate, formatMonthLabel, generateMonthRange, toMonthValue } from "../lib/format";
import { leaseTypeOptions } from "../lib/leaseType";
import type { PaymentRecord, PaymentStatus, Tenant, TenantLeaseType, TenantPaymentTerm } from "../types";
import type { Dispatch, SetStateAction } from "react";

interface PaymentsPageProps {
  tenants: Tenant[];
  payments: PaymentRecord[];
  setPayments: Dispatch<SetStateAction<PaymentRecord[]>>;
  selectedYear: number;
  theme: "dark" | "paperwhite";
}

interface MonthGeneratorForm {
  tenantId: string;
  leaseType: TenantLeaseType | "";
  startMonth: string;
  endMonth: string;
  paymentDate: string;
}

interface GeneratorToast {
  type: "complete" | "partial" | "error" | "advance";
  message: string;
}

interface PaymentEditForm {
  amount: string;
  paymentDate: string;
  referenceNo: string;
  notes: string;
}

interface MonthYearInputProps {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
}

const defaultForm: MonthGeneratorForm = {
  tenantId: "",
  leaseType: "",
  startMonth: "",
  endMonth: "",
  paymentDate: new Date().toISOString().slice(0, 10),
};

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = String(new Date().getFullYear());

const paymentTermMonths: Record<TenantPaymentTerm, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Semi-Annual": 6,
  Annually: 12,
};

const getApplicableMonthlyRate = (tenant: Tenant) => tenant.monthlyRate;

const getMonthPart = (value: string) => (value.includes("-") ? value.split("-")[1] : "");
const getYearPart = (value: string) => (value.includes("-") ? value.split("-")[0] : "");

const buildMonthValue = (month: string, year: string) => {
  if (!month || !year || year.length !== 4) {
    return "";
  }
  return `${year}-${month}`;
};

const toMonthKey = (monthValue: string) => {
  const [year, month] = monthValue.split("-").map(Number);
  return year * 12 + ((month ?? 1) - 1);
};

const addMonths = (monthValue: string, offset: number) => {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1 + offset, 1);
  return toMonthValue(date);
};

const getCycleMonths = (anchorMonth: string, monthValue: string, cycleLength: number) => {
  if (cycleLength <= 1) {
    return [monthValue];
  }

  const monthOffset = toMonthKey(monthValue) - toMonthKey(anchorMonth);
  const cycleOffset = Math.floor(monthOffset / cycleLength) * cycleLength;
  const cycleStart = addMonths(anchorMonth, cycleOffset);
  const cycleEnd = addMonths(cycleStart, cycleLength - 1);
  return generateMonthRange(cycleStart, cycleEnd);
};

export function PaymentsPage({ tenants, payments, setPayments, selectedYear, theme }: PaymentsPageProps) {
  const [generatorForm, setGeneratorForm] = useState<MonthGeneratorForm>(defaultForm);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedLeaseType, setSelectedLeaseType] = useState<TenantLeaseType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [generatorToast, setGeneratorToast] = useState<GeneratorToast | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<PaymentEditForm>({
    amount: "",
    paymentDate: "",
    referenceNo: "",
    notes: "",
  });

  useEffect(() => {
    setPayments((prev) => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const currentMonth = todayIso.slice(0, 7);
      const existingByTenantMonth = new Set(prev.map((payment) => `${payment.tenantId}-${payment.month}`));
      let sequence = 0;
      const duePayments = tenants
        .filter((tenant) => tenant.status === "active" && tenant.dueDate <= todayIso)
        .flatMap((tenant) => {
          const monthlyEquivalentRate = getApplicableMonthlyRate(tenant);
          const monthsCovered = generateMonthRange(tenant.dueDate.slice(0, 7), currentMonth);
          return monthsCovered
            .filter((month) => {
              const key = `${tenant.id}-${month}`;
              if (existingByTenantMonth.has(key)) {
                return false;
              }
              existingByTenantMonth.add(key);
              return true;
            })
            .map((month) => {
              sequence += 1;
              return {
                id: Date.now() + sequence,
                tenantId: tenant.id,
                month,
                amount: monthlyEquivalentRate,
                status: "unpaid" as PaymentStatus,
                paymentDate: null,
                referenceNo: "",
                notes: "Past the starting date",
                createdAt: new Date().toISOString(),
              };
            });
        });

      return duePayments.length ? [...prev, ...duePayments] : prev;
    });
  }, [tenants, setPayments]);

  useEffect(() => {
    if (!generatorToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGeneratorToast(null);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [generatorToast]);

  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants]);

  const generatorTenants = useMemo(() => {
    return generatorForm.leaseType ? tenants.filter((tenant) => tenant.leaseType === generatorForm.leaseType) : tenants;
  }, [generatorForm.leaseType, tenants]);

  const selectedGeneratorTenant = useMemo(() => {
    if (!generatorForm.tenantId) {
      return null;
    }
    return tenantById.get(Number(generatorForm.tenantId)) ?? null;
  }, [generatorForm.tenantId, tenantById]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const yearMatch = Number(payment.month.slice(0, 4)) === selectedYear;
      const tenantMatch = selectedTenantId ? payment.tenantId === Number(selectedTenantId) : true;
      const paymentTenant = tenantById.get(payment.tenantId);
      const leaseTypeMatch = selectedLeaseType === "all" ? true : paymentTenant?.leaseType === selectedLeaseType;
      const statusMatch = statusFilter === "all" ? true : payment.status === statusFilter;
      return yearMatch && tenantMatch && leaseTypeMatch && statusMatch;
    });
  }, [payments, selectedTenantId, selectedLeaseType, selectedYear, statusFilter, tenantById]);

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((left, right) => {
      const leftTenantName = tenantById.get(left.tenantId)?.name ?? "";
      const rightTenantName = tenantById.get(right.tenantId)?.name ?? "";
      const tenantOrder = leftTenantName.localeCompare(rightTenantName, undefined, { sensitivity: "base" });

      // Keep each tenant grouped together, then show newest covered month first.
      if (tenantOrder !== 0) {
        return tenantOrder;
      }

      const [leftYear, leftMonth] = left.month.split("-").map(Number);
      const [rightYear, rightMonth] = right.month.split("-").map(Number);
      const leftMonthKey = leftYear * 100 + leftMonth;
      const rightMonthKey = rightYear * 100 + rightMonth;
      if (leftMonthKey !== rightMonthKey) {
        return rightMonthKey - leftMonthKey;
      }

      return right.id - left.id;
    });
  }, [filteredPayments, tenantById]);

  const createMonthRange = () => {
    const tenantId = Number(generatorForm.tenantId);
    const tenant = tenantById.get(tenantId);
    if (!tenant || !generatorForm.startMonth || !generatorForm.leaseType) {
      return;
    }
    if (tenant.leaseType !== generatorForm.leaseType) {
      return;
    }

    const effectiveEndMonth = generatorForm.endMonth || generatorForm.startMonth;
    const currentMonth = toMonthValue(new Date());

    const months = generateMonthRange(generatorForm.startMonth, effectiveEndMonth);
    if (!months.length) {
      return;
    }

    const generatedAt = new Date().toISOString();
    const paymentDateForGeneratedPaid = generatorForm.paymentDate || generatedAt.slice(0, 10);
    const selectedMonths = new Set(months);
    const cycleLength = paymentTermMonths[tenant.paymentTerm] ?? 1;
    const monthlyEquivalentRate = getApplicableMonthlyRate(tenant);
    const anchorMonth = tenant.dueDate.slice(0, 7);

    if (toMonthKey(generatorForm.startMonth) < toMonthKey(anchorMonth)) {
      setGeneratorToast({
        type: "error",
        message: "Unable to input prior to the rent start date.",
      });
      return;
    }

    const cycleMap = new Map<string, string[]>();

    months.forEach((monthValue) => {
      const cycleMonths = getCycleMonths(anchorMonth, monthValue, cycleLength);
      cycleMap.set(cycleMonths[0], cycleMonths);
    });

    const partialMonths = new Set<string>();
    if (cycleLength > 1) {
      cycleMap.forEach((cycleMonths) => {
        const hasCoveredMonth = cycleMonths.some((monthValue) => selectedMonths.has(monthValue));
        if (!hasCoveredMonth) {
          return;
        }

        cycleMonths.forEach((monthValue) => {
          if (!selectedMonths.has(monthValue)) {
            partialMonths.add(monthValue);
          }
        });
      });
    }

    setPayments((prev) => {
      const updated = prev.map((record) => {
        if (record.tenantId !== tenantId) {
          return record;
        }

        if (selectedMonths.has(record.month)) {
          // Regenerating an already-covered period should mark that period as paid.
          return {
            ...record,
            amount: monthlyEquivalentRate,
            status: "paid" as PaymentStatus,
            paymentDate: paymentDateForGeneratedPaid,
            notes: "Generated by month range",
          };
        }

        if (partialMonths.has(record.month) && record.status !== "paid") {
          return {
            ...record,
            amount: monthlyEquivalentRate,
            status: "partial" as PaymentStatus,
            paymentDate: null,
            notes: "Partial payment coverage",
          };
        }

        return record;
      });

      const existingMonths = new Set(
        updated.filter((record) => record.tenantId === tenantId).map((record) => record.month),
      );

      const paidRecords = months
        .filter((monthValue) => !existingMonths.has(monthValue))
        .map((monthValue, index) => ({
          id: Date.now() + index,
          tenantId,
          month: monthValue,
          amount: monthlyEquivalentRate,
          status: "paid" as PaymentStatus,
          paymentDate: paymentDateForGeneratedPaid,
          referenceNo: "",
          notes: "Generated by month range",
          createdAt: generatedAt,
        }));

      const partialRecords = [...partialMonths]
        .filter((monthValue) => !existingMonths.has(monthValue) && !selectedMonths.has(monthValue))
        .map((monthValue, index) => ({
          id: Date.now() + paidRecords.length + index,
          tenantId,
          month: monthValue,
          amount: monthlyEquivalentRate,
          status: "partial" as PaymentStatus,
          paymentDate: null,
          referenceNo: "",
          notes: "Partial payment coverage",
          createdAt: generatedAt,
        }));

      return [...updated, ...paidRecords, ...partialRecords];
    });

    const isAdvancePayment = toMonthKey(generatorForm.startMonth) > toMonthKey(currentMonth);

    setGeneratorToast({
      type: partialMonths.size > 0 ? "partial" : isAdvancePayment ? "advance" : "complete",
      message:
        partialMonths.size > 0
          ? "Partial payment generated."
          : isAdvancePayment
            ? "Advance payment generated."
            : "Complete payment generated.",
    });
  };

  const updatePayment = (id: number, updates: Partial<PaymentRecord>) => {
    setPayments((prev) => prev.map((record) => (record.id === id ? { ...record, ...updates } : record)));
  };

  const openPaymentEdit = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    setPaymentEditForm({
      amount: String(payment.amount),
      paymentDate: payment.paymentDate ?? "",
      referenceNo: payment.referenceNo,
      notes: payment.notes,
    });
  };

  const closePaymentEdit = () => {
    setEditingPayment(null);
    setPaymentEditForm({ amount: "", paymentDate: "", referenceNo: "", notes: "" });
  };

  const savePaymentEdit = () => {
    if (!editingPayment) {
      return;
    }

    const normalizedAmount = Number(paymentEditForm.amount);
    updatePayment(editingPayment.id, {
      amount: Number.isFinite(normalizedAmount) ? normalizedAmount : 0,
      paymentDate: paymentEditForm.paymentDate || null,
      referenceNo: paymentEditForm.referenceNo.trim(),
      notes: paymentEditForm.notes.trim(),
    });
    closePaymentEdit();
  };

  const collectionsPanelClass =
    theme === "dark"
      ? "overflow-x-auto rounded-lg border border-sky-700/40 bg-sky-950/15"
      : "overflow-x-auto rounded-lg border border-sky-300 bg-sky-50/70";
  const collectionsHeadClass = theme === "dark" ? "bg-sky-900/25 text-sky-200" : "bg-sky-100 text-sky-800";
  const collectionsRowClass = theme === "dark" ? "border-t border-sky-900/50" : "border-t border-sky-200";
  const collectionsInputClass =
    theme === "dark"
      ? "rounded border border-sky-700/50 bg-sky-950/35 px-2 py-1"
      : "rounded border border-sky-300 bg-white px-2 py-1";

  return (
    <div className="space-y-8">
      {generatorToast ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div className="w-[min(92vw,24rem)] rounded-md border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
            <p
              className={`text-center ${
                generatorToast.type === "complete"
                  ? "text-emerald-300"
                  : generatorToast.type === "partial"
                    ? "text-amber-300"
                    : generatorToast.type === "advance"
                      ? "text-emerald-300"
                      : "text-rose-300"
              }`}
            >
              {generatorToast.message}
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="text-lg font-medium">Month Range Generator</h3>
        <p className="text-sm text-slate-400">Generate billing records and then edit individual month amounts/status.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-12">
          <div className="space-y-1 md:col-span-3">
            <label className="text-xs font-medium text-slate-300">Tenant</label>
            <select
              value={generatorForm.tenantId}
              onChange={(event) => {
                const nextTenantId = event.target.value;
                const nextTenant = tenantById.get(Number(nextTenantId));
                setGeneratorForm((prev) => ({
                  ...prev,
                  tenantId: nextTenantId,
                  leaseType: nextTenant?.leaseType ?? prev.leaseType,
                }));
              }}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="">Select tenant</option>
              {generatorTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-3">
            <label className="text-xs font-medium text-slate-300">Lease Type</label>
            <select
              value={generatorForm.leaseType}
              onChange={(event) => {
                const nextLeaseType = event.target.value as TenantLeaseType | "";
                setGeneratorForm((prev) => {
                  const keepTenant = prev.tenantId
                    ? tenantById.get(Number(prev.tenantId))?.leaseType === nextLeaseType
                    : false;
                  return {
                    ...prev,
                    leaseType: nextLeaseType,
                    tenantId: keepTenant ? prev.tenantId : "",
                  };
                });
              }}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="">All lease type</option>
              {leaseTypeOptions.map((leaseTypeOption) => (
                <option key={leaseTypeOption} value={leaseTypeOption}>
                  {leaseTypeOption}
                </option>
              ))}
            </select>
          </div>
          <MonthYearInput
            label="Start Month"
            value={generatorForm.startMonth}
            onChange={(nextValue) => setGeneratorForm((prev) => ({ ...prev, startMonth: nextValue }))}
            className="md:col-span-2"
          />
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-300">Payment Date</label>
            <input
              type="date"
              value={generatorForm.paymentDate}
              onChange={(event) => setGeneratorForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <button
              onClick={createMonthRange}
              className="primary-action-btn w-full rounded-md bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
            >
              Generate
            </button>
          </div>
          <MonthYearInput
            label="End Month"
            value={generatorForm.endMonth}
            onChange={(nextValue) => setGeneratorForm((prev) => ({ ...prev, endMonth: nextValue }))}
            className="md:col-span-2 md:col-start-7"
          />
          <div className="md:col-span-2 md:col-start-7">
            <p className="text-xs font-medium text-slate-300">
              Month/s covered:{" "}
              {generatorForm.startMonth
                ? generateMonthRange(generatorForm.startMonth, generatorForm.endMonth || generatorForm.startMonth).length
                : 0}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Auto monthly rate: {selectedGeneratorTenant ? formatCurrency(getApplicableMonthlyRate(selectedGeneratorTenant)) : "Select tenant and lease type"}
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <select
          value={selectedTenantId}
          onChange={(event) => setSelectedTenantId(event.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          <option value="">All tenants</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
        <select
          value={selectedLeaseType}
          onChange={(event) => setSelectedLeaseType(event.target.value as TenantLeaseType | "all")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          <option value="all">All lease type</option>
          {leaseTypeOptions.map((leaseTypeOption) => (
            <option key={leaseTypeOption} value={leaseTypeOption}>
              {leaseTypeOption}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as PaymentStatus | "all")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          <option value="all">All status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
        </select>
      </section>

      <section className={collectionsPanelClass}>
        <table className="w-full text-left text-sm">
          <thead className={collectionsHeadClass}>
            <tr>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Payment Date</th>
              <th className="px-3 py-2">Reference No</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Actions</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.map((payment) => (
              <tr key={payment.id} className={collectionsRowClass}>
                <td className="px-3 py-2">{tenantById.get(payment.tenantId)?.name ?? "Unknown"}</td>
                <td className="px-3 py-2">{formatMonthLabel(payment.month)}</td>
                <td className="px-3 py-2">{formatCurrency(payment.amount)}</td>
                <td className="px-3 py-2">{formatDate(payment.paymentDate)}</td>
                <td className="px-3 py-2">{payment.referenceNo || "-"}</td>
                <td className="px-3 py-2">{payment.notes || "-"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => openPaymentEdit(payment)}
                    className="rounded border border-slate-600 px-3 py-1 text-xs hover:bg-slate-800"
                  >
                    Edit
                  </button>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={payment.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as PaymentStatus;
                      updatePayment(payment.id, {
                        status: nextStatus,
                        paymentDate: nextStatus === "paid" ? new Date().toISOString().slice(0, 10) : payment.paymentDate,
                      });
                    }}
                    className={`collection-status-select rounded border px-2 py-1 ${
                      payment.status === "unpaid"
                        ? "status-unpaid border-rose-600 text-rose-300"
                        : payment.status === "partial"
                          ? "status-partial border-amber-600 text-amber-300"
                          : "status-paid border-emerald-600 text-emerald-300"
                    }`}
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editingPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h4 className="text-lg font-medium">Edit Collection</h4>
            <p className="text-sm text-slate-400">Update amount, payment date, reference no, and notes.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-300">Amount</span>
                <input
                  type="number"
                  value={paymentEditForm.amount}
                  onChange={(event) => setPaymentEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className={`w-full ${collectionsInputClass}`}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-300">Payment Date</span>
                <input
                  type="date"
                  value={paymentEditForm.paymentDate}
                  onChange={(event) => setPaymentEditForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                  className={`w-full ${collectionsInputClass}`}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-300">Reference No</span>
                <input
                  value={paymentEditForm.referenceNo}
                  onChange={(event) => setPaymentEditForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
                  className={`w-full ${collectionsInputClass}`}
                  placeholder="OR no"
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-slate-300">Notes</span>
                <input
                  value={paymentEditForm.notes}
                  onChange={(event) => setPaymentEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className={`w-full ${collectionsInputClass}`}
                  placeholder="Notes"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePaymentEdit}
                className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePaymentEdit}
                className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthYearInput({ label, value, onChange, className }: MonthYearInputProps) {
  const selectedMonth = getMonthPart(value);
  const selectedYear = getYearPart(value) || currentYear;

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-slate-300">{label}</label>
      <div className="grid grid-cols-[1.2fr_1fr] gap-2">
        <select
          value={selectedMonth}
          onChange={(event) => {
            const month = event.target.value;
            onChange(buildMonthValue(month, selectedYear));
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          <option value="">Month</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={2000}
          max={2100}
          value={selectedYear}
          onChange={(event) => {
            const year = event.target.value.slice(0, 4);
            onChange(buildMonthValue(selectedMonth, year));
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Year"
        />
      </div>
    </div>
  );
}