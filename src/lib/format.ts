export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, (monthIndex ?? 1) - 1, 1).toLocaleString("en-PH", {
    month: "short",
    year: "numeric",
  });
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export function toMonthValue(dateValue: Date): string {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function generateMonthRange(startMonth: string, endMonth: string): string[] {
  const [startYear, startM] = startMonth.split("-").map(Number);
  const [endYear, endM] = endMonth.split("-").map(Number);
  const startDate = new Date(startYear, (startM ?? 1) - 1, 1);
  const endDate = new Date(endYear, (endM ?? 1) - 1, 1);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return [];
  }

  const results: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    results.push(toMonthValue(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return results;
}