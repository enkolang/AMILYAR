import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "../lib/format";
import type { Expense, ExpenseCategory } from "../types";
import type { Dispatch, SetStateAction } from "react";

interface ExpensesPageProps {
  expenses: Expense[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  selectedYear: number;
  theme: "dark" | "paperwhite";
}

const defaultExpense = {
  title: "",
  category: "maintenance" as ExpenseCategory,
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function ExpensesPage({ expenses, setExpenses, selectedYear, theme }: ExpensesPageProps) {
  const [form, setForm] = useState(defaultExpense);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(defaultExpense);
  const [expenseToast, setExpenseToast] = useState<string | null>(null);

  const categoryLabel: Record<ExpenseCategory, string> = {
    renovation: "Renovation",
    maintenance: "Maintenance",
    misc: "Misc",
    bank_transaction: "Bank Transaction",
    bank_savings: "Bank Savings",
  };

  const filtered = useMemo(() => {
    const scoped = expenses.filter((expense) => new Date(expense.date).getFullYear() === selectedYear);
    const sortedByRecent = [...scoped].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return b.id - a.id;
    });

    return sortedByRecent.filter((expense) => {
      const categoryMatch = categoryFilter === "all" ? true : expense.category === categoryFilter;
      return categoryMatch;
    });
  }, [categoryFilter, expenses, selectedYear]);

  const mainOutgoings = filtered.filter((expense) => expense.category !== "bank_savings");
  const bankSavingsOutgoings = filtered.filter((expense) => expense.category === "bank_savings");

  const addExpense = () => {
    if (!form.title || !form.amount) {
      return;
    }
    const toastCategory = categoryLabel[form.category].toLowerCase();
    setExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: form.title,
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        notes: form.notes,
        createdAt: new Date().toISOString(),
      },
    ]);
    setExpenseToast(`${toastCategory} added.`);
    window.setTimeout(() => setExpenseToast(null), 2200);
    setForm(defaultExpense);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      notes: expense.notes,
    });
  };

  const closeEditModal = () => {
    setEditingExpenseId(null);
    setEditForm(defaultExpense);
  };

  const saveEditedExpense = () => {
    if (editingExpenseId === null || !editForm.title.trim() || !editForm.amount) {
      return;
    }

    setExpenses((prev) =>
      prev.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              title: editForm.title.trim(),
              category: editForm.category,
              amount: Number(editForm.amount),
              date: editForm.date,
              notes: editForm.notes,
            }
          : expense
      )
    );
    closeEditModal();
  };

  const deleteExpense = (expenseId: number) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
  };

  const total = filtered.reduce((sum, row) => sum + row.amount, 0);

  const outgoingsPanelClass =
    theme === "dark"
      ? "overflow-hidden rounded-lg border border-rose-700/45 bg-rose-950/10"
      : "overflow-hidden rounded-lg border border-rose-300 bg-rose-50/60";
  const outgoingsHeadClass =
    theme === "dark" ? "bg-rose-900/25 text-rose-200" : "bg-rose-100/85 text-rose-800";
  const outgoingsRowClass = theme === "dark" ? "border-t border-rose-800/35" : "border-t border-rose-200";
  const bankSavingsPanelClass =
    theme === "dark"
      ? "overflow-hidden rounded-lg border border-emerald-600/60 bg-emerald-950/35 shadow-[inset_0_1px_0_rgba(16,185,129,0.18)]"
      : "overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50/80";
  const bankSavingsHeaderClass =
    theme === "dark"
      ? "border-b border-emerald-600/45 bg-emerald-900/45 px-3 py-2 text-sm font-semibold text-emerald-100"
      : "border-b border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800";
  const bankSavingsHeadRowClass =
    theme === "dark" ? "bg-emerald-900/35 text-emerald-100" : "bg-emerald-100/80 text-emerald-800";
  const bankSavingsRowClass = theme === "dark" ? "border-t border-emerald-700/45" : "border-t border-emerald-200";
  const bankSavingsEmptyClass = theme === "dark" ? "text-emerald-200/70" : "text-emerald-800/70";

  return (
    <div className="space-y-8">
      {expenseToast ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div className="w-[min(92vw,24rem)] rounded-md border border-emerald-500 bg-slate-900/95 px-4 py-2 text-center text-sm text-emerald-300 shadow-lg backdrop-blur">
            {expenseToast}
          </div>
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Expense Title</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-0"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Expense title"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Category</label>
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
          >
            <option value="renovation">Renovation</option>
            <option value="maintenance">Maintenance</option>
            <option value="misc">Misc</option>
            <option value="bank_transaction">Bank Transaction</option>
            <option value="bank_savings">Bank Savings</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Amount</label>
          <input
            type="number"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="Amount"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Date</label>
          <input
            type="date"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Notes</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Notes"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={addExpense}
            className="primary-action-btn w-full rounded-md bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
          >
            Add Expense
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as ExpenseCategory | "all")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          <option value="all">All categories</option>
          <option value="renovation">Renovation</option>
          <option value="maintenance">Maintenance</option>
          <option value="misc">Misc</option>
          <option value="bank_transaction">Bank Transaction</option>
        </select>
        <p className="text-sm text-slate-400">Total filtered: {formatCurrency(total)}</p>
      </section>

      <section className={outgoingsPanelClass}>
        <div className="max-h-80 overflow-x-auto overflow-y-auto">
          <table id="outgoings-table" className="w-full text-left text-sm">
            <thead className={outgoingsHeadClass}>
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Notes</th>
                <th data-export-ignore className="px-3 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mainOutgoings.map((expense) => (
                <tr key={expense.id} className={outgoingsRowClass}>
                  <td className="px-3 py-2">{expense.title}</td>
                  <td className="px-3 py-2">{categoryLabel[expense.category]}</td>
                  <td className="px-3 py-2">{formatCurrency(expense.amount)}</td>
                  <td className="px-3 py-2">{formatDate(expense.date)}</td>
                  <td className="px-3 py-2">{expense.notes}</td>
                  <td data-export-ignore className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(expense)}
                        className={
                          theme === "dark"
                            ? "rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                            : "rounded border border-slate-400 bg-stone-100 px-2 py-1 text-xs text-slate-800 hover:bg-stone-200"
                        }
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className={
                          theme === "dark"
                            ? "rounded border border-rose-500 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                            : "rounded border border-rose-500 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {mainOutgoings.length === 0 ? (
                <tr className={outgoingsRowClass}>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    No outgoings found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={bankSavingsPanelClass}>
        <div className={bankSavingsHeaderClass}>Bank Savings</div>
        <div className="max-h-56 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm">
          <thead className={bankSavingsHeadRowClass}>
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bankSavingsOutgoings.map((expense) => (
              <tr key={expense.id} className={bankSavingsRowClass}>
                <td className="px-3 py-2">{expense.title}</td>
                <td className="px-3 py-2">{categoryLabel[expense.category]}</td>
                <td className="px-3 py-2">{formatCurrency(expense.amount)}</td>
                <td className="px-3 py-2">{formatDate(expense.date)}</td>
                <td className="px-3 py-2">{expense.notes}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(expense)}
                      className={
                        theme === "dark"
                          ? "rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                          : "rounded border border-slate-400 bg-stone-100 px-2 py-1 text-xs text-slate-800 hover:bg-stone-200"
                      }
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className={
                        theme === "dark"
                          ? "rounded border border-rose-500 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                          : "rounded border border-rose-500 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {bankSavingsOutgoings.length === 0 ? (
              <tr className={bankSavingsRowClass}>
                <td colSpan={6} className={`px-3 py-3 text-center ${bankSavingsEmptyClass}`}>
                  No bank savings entries for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </section>

      {editingExpenseId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-white">Edit Outgoing</h3>
            <p className="mt-1 text-sm text-slate-400">Update the selected outgoing record.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Expense Title</label>
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-0"
                  placeholder="Expense title"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <select
                  value={editForm.category}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <option value="renovation">Renovation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="misc">Misc</option>
                  <option value="bank_transaction">Bank Transaction</option>
                  <option value="bank_savings">Bank Savings</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Amount</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Amount"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-slate-300">Notes</label>
                <input
                  value={editForm.notes}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Notes"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedExpense}
                className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
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