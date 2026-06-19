import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DashboardPage } from "./pages/DashboardPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TenantsPage } from "./pages/TenantsPage";
import { mockExpenses, mockPayments, mockTenants } from "./store/mockData";
import { cn } from "./utils/cn";
import type { Expense, ImportHistoryEntry, PaymentRecord, Tenant } from "./types";

type PageKey = "dashboard" | "tenants" | "payments" | "expenses" | "reports" | "import-export";

const NAV_ITEMS: Array<{ key: PageKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tenants", label: "Tenants" },
  { key: "payments", label: "Collections" },
  { key: "expenses", label: "Outgoings" },
  { key: "reports", label: "Reports" },
  { key: "import-export", label: "Import/Export" },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [theme, setTheme] = useState<"dark" | "paperwhite">("dark");
  const [reportsShowAllYears, setReportsShowAllYears] = useState(false);
  const currentYear = new Date().getFullYear();
  const [pageYears, setPageYears] = useState<Record<"dashboard" | "payments" | "expenses" | "reports", number>>({
    dashboard: currentYear,
    payments: currentYear,
    expenses: currentYear,
    reports: currentYear,
  });
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
  const [payments, setPayments] = useState<PaymentRecord[]>(mockPayments);
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);

  const pageTitle = useMemo(() => {
    const current = NAV_ITEMS.find((item) => item.key === activePage);
    return current ? current.label : "Dashboard";
  }, [activePage]);

  return (
    <div
      data-theme={theme}
      className={cn(
        "min-h-screen",
        theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-stone-100 text-slate-900",
      )}
    >
      <div className="grid min-h-screen lg:grid-cols-[250px_1fr]">
        <aside
          className={cn(
            "hidden border-r p-6 backdrop-blur lg:block",
            theme === "dark" ? "border-slate-800 bg-slate-900/80" : "border-stone-300 bg-white/90",
          )}
        >
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-xl font-semibold tracking-tight">Amilyar Management</h1>
          </motion.div>
          <p className={cn("mt-1 text-sm", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
            Property dues, expenses, and reports
          </p>
          <nav className="mt-8 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={`relative w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  item.key === activePage
                    ? theme === "dark"
                      ? "bg-indigo-500/20 text-indigo-200"
                      : "bg-indigo-100 text-indigo-800"
                    : theme === "dark"
                      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-700 hover:bg-stone-200 hover:text-slate-900"
                }`}
              >
                {item.label}
                {item.key === activePage ? (
                  <motion.span
                    layoutId="active-nav"
                    className={cn(
                      "absolute inset-y-1 right-1 w-1 rounded-full",
                      theme === "dark" ? "bg-indigo-400" : "bg-indigo-600",
                    )}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex h-screen flex-col overflow-hidden p-6 pb-24 md:p-10 md:pb-28 lg:pb-10">
          <header
            className={cn(
              "sticky top-0 z-20 mb-6 flex items-center justify-between gap-3 border-b pb-5",
              theme === "dark" ? "border-slate-800" : "border-stone-300",
              theme === "dark" ? "bg-slate-950" : "bg-stone-100",
            )}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight leading-none">{pageTitle}</h2>
            </div>
            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
              {activePage === "reports" ? (
                <button
                  onClick={() => setReportsShowAllYears((prev) => !prev)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px] font-medium leading-tight transition sm:px-3 sm:text-sm",
                    reportsShowAllYears
                      ? theme === "dark"
                        ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-200"
                        : "border-emerald-600 bg-emerald-100 text-emerald-800"
                      : theme === "dark"
                        ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                        : "border-stone-300 bg-white text-slate-800 hover:bg-stone-200",
                  )}
                >
                  {reportsShowAllYears ? (
                    <>
                      <span className="block sm:hidden">All</span>
                      <span className="block sm:hidden">Years</span>
                      <span className="hidden sm:inline">All Years</span>
                    </>
                  ) : (
                    <>
                      <span className="block sm:hidden">Year</span>
                      <span className="block sm:hidden">Only</span>
                      <span className="hidden sm:inline">Year Only</span>
                    </>
                  )}
                </button>
              ) : null}
              {activePage === "dashboard" || activePage === "payments" || activePage === "expenses" || activePage === "reports" ? (
                <label className="flex items-center gap-1 text-xs font-medium">
                  <span className={cn("hidden sm:inline", theme === "dark" ? "text-slate-400" : "text-slate-600")}>Year</span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={pageYears[activePage as "dashboard" | "payments" | "expenses" | "reports"]}
                    onChange={(event) => {
                      const nextYear = Number(event.target.value) || currentYear;
                      if (activePage === "dashboard" || activePage === "payments" || activePage === "expenses" || activePage === "reports") {
                        setPageYears((prev) => ({ ...prev, [activePage]: nextYear }));
                      }
                    }}
                    className={cn(
                      "w-20 rounded-md border px-2 py-1.5 text-sm sm:w-24",
                      theme === "dark"
                        ? "border-slate-700 bg-slate-900 text-white"
                        : "border-stone-300 bg-white text-slate-900",
                    )}
                  />
                </label>
              ) : null}
              <button
                onClick={() => setTheme((prev) => (prev === "dark" ? "paperwhite" : "dark"))}
                aria-label={theme === "dark" ? "Switch to paperwhite mode" : "Switch to dark mode"}
                className={cn(
                  "rounded-md border p-2 transition",
                  theme === "dark"
                    ? "border-slate-700 text-slate-200 hover:bg-slate-800"
                    : "border-stone-300 text-slate-700 hover:bg-stone-200",
                )}
              >
                {theme === "dark" ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.section
                key={activePage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
               {activePage === "dashboard" ? (
                <DashboardPage
                  tenants={tenants}
                  payments={payments}
                  expenses={expenses}
                  theme={theme}
                  selectedYear={pageYears.dashboard}
                />
              ) : null}
              {activePage === "tenants" ? <TenantsPage tenants={tenants} setTenants={setTenants} /> : null}
              {activePage === "payments" ? (
                <PaymentsPage
                  tenants={tenants}
                  payments={payments}
                  setPayments={setPayments}
                  selectedYear={pageYears.payments}
                  theme={theme}
                />
              ) : null}
              {activePage === "expenses" ? (
                <ExpensesPage expenses={expenses} setExpenses={setExpenses} selectedYear={pageYears.expenses} theme={theme} />
              ) : null}
              {activePage === "reports" ? (
                <ReportsPage
                  tenants={tenants}
                  payments={payments}
                  setPayments={setPayments}
                  expenses={expenses}
                  selectedYear={pageYears.reports}
                  showAllYears={reportsShowAllYears}
                  theme={theme}
                />
              ) : null}
              {activePage === "import-export" ? (
                <ImportExportPage
                  tenants={tenants}
                  payments={payments}
                  expenses={expenses}
                  importHistory={importHistory}
                  setImportHistory={setImportHistory}
                  setTenants={setTenants}
                  setPayments={setPayments}
                  setExpenses={setExpenses}
                />
              ) : null}
              </motion.section>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t px-2 py-2 backdrop-blur lg:hidden",
          theme === "dark" ? "border-slate-800 bg-slate-950/95" : "border-stone-300 bg-white/95",
        )}
      >
        <div className="mx-auto grid max-w-4xl grid-cols-6 gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActivePage(item.key)}
              className={cn(
                "rounded-md px-1 py-2 text-center text-[11px] font-medium leading-tight",
                activePage === item.key
                  ? theme === "dark"
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "bg-indigo-100 text-indigo-800"
                  : theme === "dark"
                    ? "text-slate-300"
                    : "text-slate-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
