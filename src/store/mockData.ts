import type { Expense, PaymentRecord, Tenant } from "../types";

export const mockTenants: Tenant[] = [];

export const mockPayments: PaymentRecord[] = [];

export const mockExpenses: Expense[] = [
  {
    id: 1,
    title: "Perimeter fence repair",
    category: "renovation",
    amount: 5500,
    date: "2026-01-20",
    notes: "South side replacement",
    createdAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: 2,
    title: "Water line maintenance",
    category: "maintenance",
    amount: 1800,
    date: "2026-02-02",
    notes: "Leak fix",
    createdAt: "2026-02-02T00:00:00.000Z",
  },
  {
    id: 3,
    title: "Office supplies",
    category: "misc",
    amount: 650,
    date: "2026-02-08",
    notes: "Receipts filed",
    createdAt: "2026-02-08T00:00:00.000Z",
  },
];