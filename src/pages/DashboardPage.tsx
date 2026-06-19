import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDate } from "../lib/format";
import { getLeaseTypeGroup, isParkingLeaseType, isResidentialLeaseType, leaseTypeOptions } from "../lib/leaseType";
import { cn } from "../utils/cn";
import type { Expense, InactivePeriod, PaymentRecord, Tenant, TenantLeaseType } from "../types";

interface DashboardPageProps {
  tenants: Tenant[];
  payments: PaymentRecord[];
  expenses: Expense[];
  theme: "dark" | "paperwhite";
  selectedYear: number;
}

type LeaseTypeFilter = "All lease type" | TenantLeaseType;

const MONTH_HEADERS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const TERM_CONFIG = {
  Monthly: { intervalMonths: 1, count: 12 },
  Quarterly: { intervalMonths: 3, count: 4 },
  "Semi-Annual": { intervalMonths: 6, count: 2 },
  Annually: { intervalMonths: 12, count: 1 },
} as const;

type DashboardCellStatus = "not-started" | "inactive" | "pending" | "paid" | "partial" | "unpaid";

interface DashboardScheduleCell {
  monthIndex: number;
  status: DashboardCellStatus;
  amount: number | null;
  paymentDate: string | null;
  inactiveRangeLabel: string | null;
  isLatePayment: boolean;
  hasCoverageBorder: boolean;
  isCoverageStart: boolean;
  isCoverageEnd: boolean;
}

interface DashboardScheduleRow {
  tenant: Tenant;
  cells: DashboardScheduleCell[];
}

function getDisplayAmount(value: number | null): string {
  if (value === null) {
    return "";
  }
  return `${value.toLocaleString("en-PH")}`;
}

function formatDateMobile(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${String(parsed.getFullYear()).slice(-2)}`;
}

function getLatestPaymentByMonth(tenantPayments: PaymentRecord[]): Map<string, PaymentRecord> {
  return tenantPayments.reduce<Map<string, PaymentRecord>>((map, payment) => {
    const existing = map.get(payment.month);
    if (!existing || payment.id > existing.id) {
      map.set(payment.month, payment);
    }
    return map;
  }, new Map<string, PaymentRecord>());
}

function getMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getInactivePeriodForMonth(year: number, monthIndex: number, periods: InactivePeriod[]): InactivePeriod | null {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  monthStart.setHours(0, 0, 0, 0);
  monthEnd.setHours(0, 0, 0, 0);

  for (const period of periods) {
    const periodStart = new Date(period.startDate);
    const periodEnd = period.endDate ? new Date(period.endDate) : new Date();
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      continue;
    }
    const normalizedStart = periodStart <= periodEnd ? periodStart : periodEnd;
    const normalizedEnd = periodStart <= periodEnd ? periodEnd : periodStart;
    normalizedStart.setHours(0, 0, 0, 0);
    normalizedEnd.setHours(0, 0, 0, 0);

    if (normalizedStart <= monthEnd && normalizedEnd >= monthStart) {
      return {
        startDate: normalizedStart.toISOString().slice(0, 10),
        endDate: period.endDate ? normalizedEnd.toISOString().slice(0, 10) : undefined,
      };
    }
  }

  return null;
}

function buildScheduleRow(
  tenant: Tenant,
  year: number,
  tenantPayments: PaymentRecord[],
  todayIso: string,
): DashboardScheduleRow {
  const cells: DashboardScheduleCell[] = [];
  const termConfig = TERM_CONFIG[tenant.paymentTerm];
  const tenantStart = new Date(tenant.dueDate);
  const tenantStartMonth = new Date(tenantStart.getFullYear(), tenantStart.getMonth(), 1);
  const startYear = tenantStart.getFullYear();
  const startMonthIndex = tenantStart.getMonth();
  const startDay = tenantStart.getDate();
  const today = new Date(todayIso);
  today.setHours(0, 0, 0, 0);
  const latestPaymentByMonth = getLatestPaymentByMonth(tenantPayments);
  const currentMonthCursor = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const displayMonth = new Date(year, monthIndex, 1);
    const isActiveMonth = displayMonth >= tenantStartMonth;

    if (!isActiveMonth) {
      cells.push({
        monthIndex,
        status: "not-started",
        amount: null,
        paymentDate: null,
        inactiveRangeLabel: null,
        isLatePayment: false,
        hasCoverageBorder: false,
        isCoverageStart: false,
        isCoverageEnd: false,
      });
      continue;
    }

    const matchingInactivePeriod = getInactivePeriodForMonth(year, monthIndex, tenant.inactivePeriods ?? []);

    if (matchingInactivePeriod) {
      const inactiveRangeLabel = `Inactive: ${formatDate(matchingInactivePeriod.startDate)} to ${
        matchingInactivePeriod.endDate ? formatDate(matchingInactivePeriod.endDate) : "Present"
      }`;
      cells.push({
        monthIndex,
        status: "inactive",
        amount: null,
        paymentDate: null,
        inactiveRangeLabel,
        isLatePayment: false,
        hasCoverageBorder: false,
        isCoverageStart: false,
        isCoverageEnd: false,
      });
      continue;
    }

    const monthKey = getMonthKey(year, monthIndex);
    const payment = latestPaymentByMonth.get(monthKey) ?? null;
    const displayMonthCursor = new Date(year, monthIndex, 1);
    const monthReached = displayMonthCursor <= currentMonthCursor;
    const monthOffset = (year - startYear) * 12 + (monthIndex - startMonthIndex);
    const cycleOffset = Math.floor(monthOffset / termConfig.intervalMonths) * termConfig.intervalMonths;
    const cycleDueDate = new Date(startYear, startMonthIndex + cycleOffset, startDay);
    const cycleStartDate = new Date(startYear, startMonthIndex + cycleOffset, 1);
    const cycleEndDate = new Date(startYear, startMonthIndex + cycleOffset + termConfig.intervalMonths - 1, 1);
    cycleDueDate.setHours(0, 0, 0, 0);
    const isOverdue = today >= cycleDueDate;
    const hasCoverageBorder = cycleStartDate.getFullYear() === year && cycleEndDate.getFullYear() === year;
    const isCoverageStart = hasCoverageBorder && cycleStartDate.getMonth() === monthIndex;
    const isCoverageEnd = hasCoverageBorder && cycleEndDate.getMonth() === monthIndex;

    let status: DashboardCellStatus = "pending";
    if (!payment) {
      status = isOverdue && monthReached ? "unpaid" : "pending";
    } else if (payment.status === "paid") {
      status = "paid";
    } else if (payment.status === "partial") {
      status = "partial";
    } else {
      status = isOverdue && monthReached ? "unpaid" : "pending";
    }

    const paymentDateValue = payment?.paymentDate ?? null;
    const parsedPaymentDate = paymentDateValue ? new Date(paymentDateValue) : null;
    const isLatePayment =
      status === "paid" &&
      parsedPaymentDate !== null &&
      !Number.isNaN(parsedPaymentDate.getTime()) &&
      parsedPaymentDate > cycleDueDate;

    cells.push({
      monthIndex,
      status,
      amount: payment ? payment.amount : null,
      paymentDate: paymentDateValue,
      inactiveRangeLabel: null,
      isLatePayment,
      hasCoverageBorder,
      isCoverageStart,
      isCoverageEnd,
    });
  }

  return { tenant, cells };
}

export function DashboardPage({ tenants, payments, expenses, theme, selectedYear }: DashboardPageProps) {
  const [leaseTypeFilter, setLeaseTypeFilter] = useState<LeaseTypeFilter>("All lease type");
  const [showLatePayment, setShowLatePayment] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const syncViewport = () => setIsCompactViewport(window.innerWidth < 1280);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const yearPrefix = `${selectedYear}-`;
  const yearPayments = payments.filter((payment) => payment.month.startsWith(yearPrefix));
  const yearExpenses = expenses.filter((expense) => expense.date.startsWith(yearPrefix));
  const monthlyCollections = yearPayments.filter((payment) => payment.status === "paid").reduce((sum, row) => sum + row.amount, 0);
  const outstanding = yearPayments
    .filter((payment) => payment.status !== "paid")
    .reduce((sum, row) => sum + row.amount, 0);
  const savingsTotal = yearExpenses
    .filter((expense) => expense.category === "bank_savings")
    .reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = yearExpenses
    .filter((expense) => expense.category !== "bank_savings")
    .reduce((sum, row) => sum + row.amount, 0);
  const yearlyNet = monthlyCollections + savingsTotal - expenseTotal;

  const formatAxisNumber = (value: number) => value.toLocaleString("en-PH");

  const monthlyChartRows = MONTH_HEADERS.map((monthLabel, monthIndex) => {
    const monthKey = getMonthKey(selectedYear, monthIndex);
    const paid = yearPayments
      .filter((payment) => payment.month === monthKey && payment.status === "paid")
      .reduce((sum, row) => sum + row.amount, 0);
    const unpaid = yearPayments
      .filter((payment) => payment.month === monthKey && payment.status === "unpaid")
      .reduce((sum, row) => sum + row.amount, 0);
    return { monthLabel, monthKey, paid, unpaid };
  });

  const incomeVsExpenses = monthlyChartRows.map((monthRow) => {
    const monthExpense = yearExpenses
      .filter((expense) => expense.category !== "bank_savings")
      .filter((expense) => expense.date.startsWith(monthRow.monthKey))
      .reduce((sum, row) => sum + row.amount, 0);
    const monthSavings = yearExpenses
      .filter((expense) => expense.category === "bank_savings")
      .filter((expense) => expense.date.startsWith(monthRow.monthKey))
      .reduce((sum, row) => sum + row.amount, 0);
    return {
      month: monthRow.monthLabel,
      income: monthRow.paid,
      expense: monthExpense,
      savings: monthSavings,
    };
  });

  const isDark = theme === "dark";
  const chartGrid = isDark ? "#1e293b" : "#cbd5e1";
  const chartAxis = isDark ? "#94a3b8" : "#334155";
  const paidBarColor = isDark ? "#22c55e" : "#7fd7bf";
  const unpaidBarColor = isDark ? "#f43f5e" : "#f6a3ae";
  const panelClass = isDark ? "border-slate-800 bg-slate-900/50" : "border-stone-300 bg-white";
  const mutedText = isDark ? "text-slate-400" : "text-slate-600";
  const tableDivider = isDark ? "border-slate-800" : "border-stone-200";
  const paymentsByTenant = useMemo(() => {
    return payments.reduce<Map<number, PaymentRecord[]>>((map, payment) => {
      const list = map.get(payment.tenantId) ?? [];
      list.push(payment);
      map.set(payment.tenantId, list);
      return map;
    }, new Map<number, PaymentRecord[]>());
  }, [payments]);

  const visibleTenants = useMemo(() => {
    const activeTenants = tenants.filter((tenant) => tenant.status === "active");
    if (leaseTypeFilter !== "All lease type") {
      return activeTenants
        .filter((tenant) => tenant.leaseType === leaseTypeFilter)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const residentialTenants = activeTenants
      .filter((tenant) => isResidentialLeaseType(tenant.leaseType))
      .sort((a, b) => a.name.localeCompare(b.name));
    const parkingTenants = activeTenants
      .filter((tenant) => isParkingLeaseType(tenant.leaseType))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...residentialTenants, ...parkingTenants];
  }, [tenants, leaseTypeFilter]);

  const scheduleRows = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return visibleTenants.map((tenant) => buildScheduleRow(tenant, selectedYear, paymentsByTenant.get(tenant.id) ?? [], todayIso));
  }, [visibleTenants, selectedYear, paymentsByTenant]);

  return (
    <div className="flex flex-col gap-8">
      <div className="order-1 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryBlock title="Total Collections" value={formatCurrency(monthlyCollections)} theme={theme} />
        <SummaryBlock title="Outstanding Balances" value={formatCurrency(outstanding)} theme={theme} />
        <SummaryBlock title="Total Savings" value={formatCurrency(savingsTotal)} theme={theme} />
        <SummaryBlock title="Total Expenses" value={formatCurrency(expenseTotal)} theme={theme} />
        <SummaryBlock title="Net Income" value={formatCurrency(yearlyNet)} theme={theme} />
      </div>

      <section className="order-3 grid gap-8 xl:grid-cols-2">
        <div>
          <h3 className="text-lg font-medium">Monthly Collections</h3>
          <p className={cn("text-sm", mutedText)}>Paid vs unpaid dues by month</p>
          <div className={cn("mt-4 h-72 rounded-lg border p-3", panelClass)}>
            <ResponsiveContainer>
              <BarChart data={monthlyChartRows} margin={isCompactViewport ? { top: 6, right: 6, left: -22, bottom: 0 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="monthLabel" stroke={chartAxis} />
                <YAxis stroke={chartAxis} width={isCompactViewport ? 22 : 36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#cbd5e1",
                    color: isDark ? "#e2e8f0" : "#0f172a",
                  }}
                />
                <Legend />
                <Bar dataKey="paid" fill={paidBarColor} />
                <Bar dataKey="unpaid" fill={unpaidBarColor} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium">Income vs Expenses</h3>
          <p className={cn("text-sm", mutedText)}>Operations health trend line</p>
          <div className={cn("mt-4 h-72 rounded-lg border p-3", panelClass)}>
            <ResponsiveContainer>
              <LineChart data={incomeVsExpenses} margin={isCompactViewport ? { top: 6, right: 6, left: 6, bottom: 0 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="month" stroke={chartAxis} />
                <YAxis
                  stroke={chartAxis}
                  width={isCompactViewport ? 52 : 48}
                  tickFormatter={formatAxisNumber}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#cbd5e1",
                    color: isDark ? "#e2e8f0" : "#0f172a",
                  }}
                />
                <Legend />
                <Line dataKey="income" stroke="#60a5fa" strokeWidth={2} />
                <Line dataKey="expense" stroke="#fb7185" strokeWidth={2} />
                <Line dataKey="savings" stroke="#34d399" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className={cn("order-2 rounded-lg border p-5", panelClass)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">Yearly Collection Matrix</h3>
            <p className={cn("text-sm", mutedText)}>Status is generated from starting date, payment term, and payment logs.</p>
          </div>

          <div className="ml-auto flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowLatePayment((prev) => !prev)}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-semibold transition",
                showLatePayment
                  ? isDark
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-cyan-600 bg-cyan-100 text-cyan-800"
                  : isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    : "border-stone-300 bg-white text-slate-800 hover:bg-stone-100",
              )}
            >
              Late Payment
            </button>

            <label className="space-y-1 text-xs font-medium">
              <span className={mutedText}>Lease Type</span>
              <select
                value={leaseTypeFilter}
                onChange={(event) => setLeaseTypeFilter(event.target.value as LeaseTypeFilter)}
                className={cn(
                  "w-32 rounded-md border px-3 py-2",
                  isDark ? "border-slate-700 bg-slate-900" : "border-stone-300 bg-white",
                )}
              >
                <option value="All lease type">All lease type</option>
                {leaseTypeOptions.map((leaseTypeOption) => (
                  <option key={leaseTypeOption} value={leaseTypeOption}>
                    {leaseTypeOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-[17%] md:w-[14%]" />
              <col className="w-[11%]" />
              <col className="hidden w-[11%] md:table-column" />
              {MONTH_HEADERS.map((month) => (
                <col key={`col-${month}`} className="w-[6%] md:w-[5.33%]" />
              ))}
            </colgroup>
            <thead>
              <tr className={cn("border", tableDivider)}>
                <th className={cn("border px-1 py-2 font-semibold md:px-2", tableDivider)} rowSpan={2}>
                  <span className="md:hidden">Name</span>
                  <span className="hidden md:inline">Name of Tenant</span>
                </th>
                <th className={cn("border px-1 py-2 font-semibold md:px-2", tableDivider)} rowSpan={2}>
                  <span className="md:hidden">P. Type</span>
                  <span className="hidden md:inline">Payment Type</span>
                </th>
                <th className={cn("hidden border px-2 py-2 font-semibold md:table-cell", tableDivider)} rowSpan={2}>
                  <span className="md:hidden">S.Date</span>
                  <span className="hidden md:inline">Starting Date</span>
                </th>
                <th className={cn("border px-2 py-2 text-center text-base font-semibold tracking-[0.45em]", tableDivider)} colSpan={12}>
                  {selectedYear}
                </th>
              </tr>
              <tr>
                {MONTH_HEADERS.map((month, monthIndex) => (
                  <th
                    key={month}
                    className={cn("border px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap", tableDivider)}
                  >
                    <span className="md:hidden">{MONTH_INITIALS[monthIndex]}</span>
                    <span className="hidden md:inline">{month}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map(({ tenant, cells }, index) => {
                const currentLeaseGroup = getLeaseTypeGroup(tenant.leaseType);
                const previousLeaseGroup = scheduleRows[index - 1]
                  ? getLeaseTypeGroup(scheduleRows[index - 1].tenant.leaseType)
                  : null;
                const showBreak = leaseTypeFilter === "All lease type" && previousLeaseGroup !== currentLeaseGroup;

                return (
                  <Fragment key={tenant.id}>
                    {showBreak ? (
                      <tr key={`break-${tenant.leaseType}-${tenant.id}`}>
                        <td
                          colSpan={15}
                          className={cn(
                            "border px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                            tableDivider,
                            isDark ? "bg-slate-900 text-slate-300" : "bg-stone-100 text-slate-700",
                          )}
                        >
                           {currentLeaseGroup}
                        </td>
                      </tr>
                    ) : null}

                    <tr className={cn("group border", tableDivider)}>
                      <td className={cn("border px-1 py-2 text-[11px] leading-tight md:px-2 md:text-xs", tableDivider)} title={tenant.name}>
                        <span className="block truncate">{tenant.name}</span>
                      </td>
                      <td className={cn("border px-1 py-2 text-[11px] leading-tight md:px-2 md:text-xs", tableDivider)}>
                        <span className="md:hidden">
                          {tenant.paymentTerm === "Monthly"
                            ? "M"
                            : tenant.paymentTerm === "Quarterly"
                              ? "Q"
                              : tenant.paymentTerm === "Semi-Annual"
                                ? "S"
                                : "A"}
                        </span>
                        <span className="hidden md:inline">{tenant.paymentTerm}</span>
                        <span className="ml-1 text-emerald-300 opacity-0 transition-opacity group-hover:opacity-100">
                          ({TERM_CONFIG[tenant.paymentTerm].count})
                        </span>
                      </td>
                      <td className={cn("hidden border px-2 py-2 md:table-cell", tableDivider)}>
                        <span className="md:hidden">{formatDateMobile(tenant.dueDate)}</span>
                        <span className="hidden md:inline">{formatDate(tenant.dueDate)}</span>
                      </td>
                      {cells.map((cell) => {
                        const baseClass = "group/cell h-11 border px-1 py-1 text-center align-middle whitespace-nowrap";
                        const coverageBorderClass = cell.hasCoverageBorder
                          ? cn(
                              isDark ? "border-y-2 border-y-slate-300" : "border-y-2 border-y-slate-500",
                              cell.isCoverageStart ? (isDark ? "border-l-2 border-l-slate-300" : "border-l-2 border-l-slate-500") : "",
                              cell.isCoverageEnd ? (isDark ? "border-r-2 border-r-slate-300" : "border-r-2 border-r-slate-500") : "",
                            )
                          : "";
                        const themeClass =
                          cell.status === "not-started"
                            ? isDark
                              ? "bg-slate-800/60 text-slate-500"
                              : "bg-stone-200 text-slate-500"
                            : cell.status === "inactive"
                              ? isDark
                                ? "bg-slate-700/70 text-slate-300"
                                : "bg-slate-300 text-slate-700"
                            : cell.status === "paid" && showLatePayment && cell.isLatePayment
                              ? isDark
                                ? "bg-cyan-600/75 text-cyan-50"
                                : "bg-cyan-200 text-cyan-900"
                            : cell.status === "paid"
                              ? isDark
                                ? "bg-emerald-700/80"
                                : "bg-emerald-200"
                              : cell.status === "partial"
                                ? isDark
                                  ? "bg-amber-600/70 text-amber-100"
                                  : "bg-amber-200 text-amber-900"
                                : cell.status === "unpaid"
                                  ? isDark
                                    ? "bg-rose-700/80 text-rose-50"
                                    : "bg-rose-200 text-rose-900"
                                  : isDark
                                    ? "bg-slate-900/40 text-slate-500"
                                    : "bg-white text-slate-500";

                        return (
                          <td
                            key={`${tenant.id}-${cell.monthIndex}`}
                            className={cn(baseClass, tableDivider, coverageBorderClass, themeClass)}
                            title={
                              cell.status === "paid"
                                ? `${getDisplayAmount(cell.amount)} ${cell.paymentDate ? `(${formatDate(cell.paymentDate)})` : ""}${
                                    cell.isLatePayment ? " - LATE PAYMENT" : ""
                                  }`
                                : cell.status === "inactive"
                                  ? cell.inactiveRangeLabel ?? "Inactive"
                                : cell.status === "partial"
                                  ? "PARTIAL"
                                  : cell.status === "unpaid"
                                    ? "UNPAID"
                                    : ""
                            }
                          >
                            {cell.status === "paid" ? (
                              <p
                                  className={cn(
                                    "truncate text-xs font-medium opacity-0 transition-opacity group-hover/cell:opacity-100",
                                  isDark ? "text-emerald-100" : "text-emerald-800",
                                )}
                              >
                                {getDisplayAmount(cell.amount)}
                                {cell.paymentDate ? ` (${formatDate(cell.paymentDate)})` : ""}
                              </p>
                            ) : null}
                            {cell.status === "partial" ? (
                              <p className="text-xs font-semibold opacity-0 transition-opacity group-hover/cell:opacity-100">PARTIAL</p>
                            ) : null}
                            {cell.status === "unpaid" ? (
                              <p className="text-xs font-semibold opacity-0 transition-opacity group-hover/cell:opacity-100">UNPAID</p>
                            ) : null}
                            {cell.status === "inactive" ? (
                              <p className="truncate text-[10px] font-medium opacity-0 transition-opacity group-hover/cell:opacity-100">
                                {cell.inactiveRangeLabel}
                              </p>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
              {scheduleRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className={cn("border px-3 py-4 text-center text-sm", tableDivider, mutedText)}>
                    No active tenants found for this lease type.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryBlock({
  title,
  value,
  theme,
}: {
  title: string;
  value: string;
  theme: "dark" | "paperwhite";
}) {
  const isDark = theme === "dark";
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isDark ? "border-sky-800/60 bg-sky-950/30" : "border-sky-200 bg-sky-50/70",
      )}
    >
      <p className={cn("text-sm", isDark ? "text-sky-200/80" : "text-sky-800")}>{title}</p>
      <p className={cn("mt-2 text-4xl font-semibold leading-none", isDark ? "text-sky-100" : "text-sky-900")}>{value}</p>
    </div>
  );
}
