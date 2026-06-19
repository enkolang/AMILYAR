import * as XLSX from "xlsx";

export function parsePaymentImportSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet).map((row) => ({
    tenant_name: row.tenant_name,
    lease_type: row.lease_type,
    amount: Number(row.amount),
    month: row.month,
  }));
}

export function buildWorkbook(dataMap) {
  const workbook = XLSX.utils.book_new();
  Object.entries(dataMap).forEach(([sheetName, rows]) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}