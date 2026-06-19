import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "../lib/format";
import { isParkingLeaseType, isResidentialLeaseType, leaseTypeOptions } from "../lib/leaseType";
import type { InactivePeriod, Tenant, TenantLeaseType, TenantPaymentTerm, TenantStatus } from "../types";
import type { Dispatch, SetStateAction } from "react";

interface TenantsPageProps {
  tenants: Tenant[];
  setTenants: Dispatch<SetStateAction<Tenant[]>>;
}

const paymentTermOptions: TenantPaymentTerm[] = ["Monthly", "Quarterly", "Semi-Annual", "Annually"];

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);

const defaultTenantInput = {
  name: "",
  lotNo: "",
  leaseType: "House" as TenantLeaseType,
  paymentTerm: "Monthly" as TenantPaymentTerm,
  dueDate: getTodayDateInputValue(),
  monthlyRate: "500",
};

const defaultEditTenantInput = {
  ...defaultTenantInput,
  status: "active" as TenantStatus,
  inactiveStartDate: "",
  inactiveEndDate: "",
};

export function TenantsPage({ tenants, setTenants }: TenantsPageProps) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(defaultTenantInput);
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(defaultEditTenantInput);
  const [editInactivePeriods, setEditInactivePeriods] = useState<InactivePeriod[]>([]);
  const [tenantToast, setTenantToast] = useState<{ message: string; leaseType: TenantLeaseType } | null>(null);
  const [editError, setEditError] = useState("");

  const filteredTenants = useMemo(
    () => tenants.filter((tenant) => tenant.name.toLowerCase().includes(query.toLowerCase())),
    [query, tenants]
  );

  const residentialTenants = useMemo(
    () => filteredTenants.filter((tenant) => isResidentialLeaseType(tenant.leaseType)),
    [filteredTenants]
  );

  const parkingTenants = useMemo(
    () => filteredTenants.filter((tenant) => isParkingLeaseType(tenant.leaseType)),
    [filteredTenants]
  );

  const lotFieldLabel = isParkingLeaseType(form.leaseType) ? "Plate no" : "Lot no";

  const addTenant = () => {
    if (!form.name.trim()) {
      return;
    }

    const createdTenant: Tenant = {
      id: Date.now(),
      name: form.name.trim(),
      lotNo: form.lotNo.trim(),
      leaseType: form.leaseType,
      paymentTerm: form.paymentTerm,
      dueDate: form.dueDate,
      monthlyRate: Number(form.monthlyRate),
      status: "active",
      inactivePeriods: [],
      createdAt: new Date().toISOString(),
    };

    setTenants((prev) => [...prev, createdTenant]);
    setTenantToast({
      message: `${createdTenant.leaseType} tenant added.`,
      leaseType: createdTenant.leaseType,
    });
    window.setTimeout(() => setTenantToast(null), 1800);
    setForm(defaultTenantInput);
  };

  const openEditModal = (tenant: Tenant) => {
    const hasInactiveHistory = (tenant.inactivePeriods ?? []).length > 0;
    setEditError("");
    setEditingTenantId(tenant.id);
    setEditInactivePeriods(tenant.inactivePeriods ?? []);
    setEditForm({
      name: tenant.name,
      lotNo: tenant.lotNo,
      leaseType: tenant.leaseType,
      paymentTerm: tenant.paymentTerm,
      dueDate: tenant.dueDate,
      monthlyRate: String(tenant.monthlyRate),
      status: tenant.status,
      inactiveStartDate: hasInactiveHistory ? getTodayDateInputValue() : "",
      inactiveEndDate: "",
    });
  };

  const closeEditModal = () => {
    setEditingTenantId(null);
    setEditForm(defaultEditTenantInput);
    setEditInactivePeriods([]);
    setEditError("");
  };

  const normalizeInactivePeriod = (startDate: string, endDate?: string): InactivePeriod | null => {
    if (!startDate) {
      return null;
    }
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    if (!endDate) {
      return { startDate };
    }
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return { startDate };
    }
    if (start.getTime() <= end.getTime()) {
      return { startDate, endDate };
    }
    return { startDate: endDate, endDate: startDate };
  };

  const hasSamePeriod = (left: InactivePeriod, right: InactivePeriod) =>
    left.startDate === right.startDate && (left.endDate ?? "") === (right.endDate ?? "");

  const addCurrentRangeToHistory = () => {
    if (!editForm.inactiveStartDate || !editForm.inactiveEndDate) {
      setEditError("Set both Inactive From and Inactive To to add a history range.");
      return;
    }
    const normalized = normalizeInactivePeriod(editForm.inactiveStartDate, editForm.inactiveEndDate);
    if (!normalized) {
      setEditError("Invalid inactive range.");
      return;
    }
    setEditError("");
    setEditInactivePeriods((prev) => (prev.some((period) => hasSamePeriod(period, normalized)) ? prev : [...prev, normalized]));
    setEditForm((prev) => ({ ...prev, inactiveStartDate: "", inactiveEndDate: "", status: "active" }));
  };

  const handleInactiveEndDateChange = (endDate: string) => {
    setEditForm((prev) => ({
      ...prev,
      inactiveEndDate: endDate,
      // Closing the inactive range reactivates tenant status.
      status: endDate ? "active" : prev.status,
    }));
  };

  const handleStatusToggle = () => {
    setEditForm((prev) => {
      const isSwitchingToInactive = prev.status === "active";
      if (isSwitchingToInactive) {
        return {
          ...prev,
          status: "inactive",
          inactiveStartDate: prev.inactiveStartDate || getTodayDateInputValue(),
          inactiveEndDate: "",
        };
      }

      // When switching back to active, close any open inactive range and remove "to Present" history entries.
      if (prev.inactiveStartDate && !prev.inactiveEndDate) {
        const closedRange = normalizeInactivePeriod(prev.inactiveStartDate, getTodayDateInputValue());
        if (closedRange) {
          setEditInactivePeriods((existing) =>
            (() => {
              const withoutOpenRanges = existing.filter((period) => Boolean(period.endDate));
              return withoutOpenRanges.some((period) => hasSamePeriod(period, closedRange))
                ? withoutOpenRanges
                : [...withoutOpenRanges, closedRange];
            })()
          );
        } else {
          setEditInactivePeriods((existing) => existing.filter((period) => Boolean(period.endDate)));
        }
      } else {
        setEditInactivePeriods((existing) => existing.filter((period) => Boolean(period.endDate)));
      }

      return {
        ...prev,
        status: "active",
        inactiveStartDate: "",
        inactiveEndDate: "",
      };
    });
  };

  const removeHistoryRange = (range: InactivePeriod) => {
    setEditInactivePeriods((prev) => prev.filter((period) => !hasSamePeriod(period, range)));
  };

  const saveEditTenant = () => {
    if (editingTenantId === null || !editForm.name.trim()) {
      return;
    }

    const resolvedStatus: TenantStatus = editForm.inactiveEndDate ? "active" : editForm.status;

    if (resolvedStatus === "inactive" && !editForm.inactiveStartDate) {
      setEditError("Inactive from date is required when status is inactive.");
      return;
    }

    setEditError("");

    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.id === editingTenantId
          ? (() => {
              const shouldAppendTypedPeriod = Boolean(editForm.inactiveStartDate) &&
                (resolvedStatus === "inactive" || Boolean(editForm.inactiveEndDate));
              const typedPeriod = shouldAppendTypedPeriod
                ? normalizeInactivePeriod(editForm.inactiveStartDate, editForm.inactiveEndDate)
                : null;
              const basePeriods = resolvedStatus === "active"
                ? editInactivePeriods.filter((period) => Boolean(period.endDate))
                : editInactivePeriods;
              const allPeriods = typedPeriod
                ? [...basePeriods, typedPeriod].filter(
                    (period, index, source) =>
                      source.findIndex((target) => hasSamePeriod(target, period)) === index,
                  )
                : basePeriods;

              return {
                ...tenant,
                name: editForm.name.trim(),
                lotNo: editForm.lotNo.trim(),
                leaseType: editForm.leaseType,
                paymentTerm: editForm.paymentTerm,
                dueDate: editForm.dueDate,
                monthlyRate: Number(editForm.monthlyRate),
                status: resolvedStatus,
                inactivePeriods: allPeriods,
              };
            })()
          : tenant,
      )
    );
    closeEditModal();
  };

  return (
    <div className="space-y-8">
      {tenantToast ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2">
          <div
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              isResidentialLeaseType(tenantToast.leaseType)
                ? "border-emerald-500 bg-emerald-900/80 text-emerald-100"
                : "border-sky-500 bg-sky-900/80 text-sky-100"
            }`}
          >
            {tenantToast.message}
          </div>
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Tenant Name</label>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-0"
            placeholder="Tenant name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">{lotFieldLabel}</label>
          <input
            value={form.lotNo}
            onChange={(event) => setForm((prev) => ({ ...prev, lotNo: event.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder={lotFieldLabel}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Lease Type</label>
          <select
            value={form.leaseType}
            onChange={(event) => setForm((prev) => ({ ...prev, leaseType: event.target.value as TenantLeaseType }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
          >
            {leaseTypeOptions.map((leaseTypeOption) => (
              <option key={leaseTypeOption}>{leaseTypeOption}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Payment Terms</label>
          <select
            value={form.paymentTerm}
            onChange={(event) => setForm((prev) => ({ ...prev, paymentTerm: event.target.value as TenantPaymentTerm }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
          >
            {paymentTermOptions.map((term) => (
              <option key={term}>{term}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Starting Date</label>
          <input
            value={form.dueDate}
            onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="date"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Monthly Rate</label>
          <input
            value={form.monthlyRate}
            onChange={(event) => setForm((prev) => ({ ...prev, monthlyRate: event.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Monthly rate"
            type="number"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={addTenant}
            className="w-full rounded-md bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
          >
            Add Tenant
          </button>
        </div>
      </section>

      <section>
        <div className="space-y-1 md:max-w-sm">
          <label className="text-xs font-medium text-slate-300">Search Tenant</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Filter tenants by name"
          />
        </div>
        <div className="mt-4 space-y-6">
          <TenantTable
            title="Residential"
            lotColumnLabel="Lot No"
            tenants={residentialTenants}
            onEditTenant={openEditModal}
          />
          <TenantTable
            title="Parking"
            lotColumnLabel="Plate No"
            tenants={parkingTenants}
            onEditTenant={openEditModal}
          />
        </div>
      </section>

      {editingTenantId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-white">Edit Tenant</h3>
            <p className="mt-1 text-sm text-slate-400">Revise tenant details and update status.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Tenant Name</label>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-0"
                  placeholder="Tenant name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  {isParkingLeaseType(editForm.leaseType) ? "Plate no" : "Lot no"}
                </label>
                <input
                  value={editForm.lotNo}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, lotNo: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder={isParkingLeaseType(editForm.leaseType) ? "Plate no" : "Lot no"}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Lease Type</label>
                <select
                  value={editForm.leaseType}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, leaseType: event.target.value as TenantLeaseType }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  {leaseTypeOptions.map((leaseTypeOption) => (
                    <option key={leaseTypeOption}>{leaseTypeOption}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Payment Terms</label>
                <select
                  value={editForm.paymentTerm}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, paymentTerm: event.target.value as TenantPaymentTerm }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  {paymentTermOptions.map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Starting Date</label>
                <input
                  value={editForm.dueDate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  type="date"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Monthly Rate</label>
                <input
                  value={editForm.monthlyRate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monthlyRate: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Monthly rate"
                  type="number"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
              <span className="text-sm text-slate-300">Status</span>
              <button
                onClick={handleStatusToggle}
                className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                  editForm.status === "active"
                    ? "border border-emerald-700 bg-emerald-900/40 text-emerald-300"
                    : "border border-amber-700 bg-amber-900/40 text-amber-300"
                }`}
              >
                {editForm.status}
              </button>
            </div>

            {editForm.status === "inactive" || editForm.inactiveStartDate || editForm.inactiveEndDate ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Inactive From</label>
                  <input
                    type="date"
                    value={editForm.inactiveStartDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, inactiveStartDate: event.target.value }))}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Inactive To</label>
                  <input
                    type="date"
                    value={editForm.inactiveEndDate}
                    onChange={(event) => handleInactiveEndDateChange(event.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                  <p className="text-[11px] text-slate-500">Leave blank if still inactive up to today.</p>
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={addCurrentRangeToHistory}
                    className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Add Range to History
                  </button>
                </div>
              </div>
            ) : null}

            {editInactivePeriods.length > 0 ? (
              <div className="mt-3 rounded-md border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">History</p>
                <div className="mt-2 space-y-2">
                  {editInactivePeriods.map((period, index) => (
                    <div
                      key={`${period.startDate}-${period.endDate ?? "open"}-${index}`}
                      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs"
                    >
                      <span className="text-slate-300">
                        {formatDate(period.startDate)} to {period.endDate ? formatDate(period.endDate) : "Present"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHistoryRange(period)}
                        className="rounded border border-rose-700 px-2 py-1 text-rose-300 hover:bg-rose-900/30"
                        aria-label="Delete inactive history range"
                        title="Delete range"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {editError ? <p className="mt-2 text-xs text-rose-300">{editError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEditTenant}
                className="rounded bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
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

interface TenantTableProps {
  title: string;
  lotColumnLabel: string;
  tenants: Tenant[];
  onEditTenant: (tenant: Tenant) => void;
}

function TenantTable({ title, lotColumnLabel, tenants, onEditTenant }: TenantTableProps) {
  const orderedTenants = [...tenants].sort(
    (left, right) => Number(left.status === "inactive") - Number(right.status === "inactive")
  );

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300">{title} Tenants</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">{lotColumnLabel}</th>
              <th className="px-3 py-2">Lease Type</th>
              <th className="px-3 py-2">Payment Terms</th>
              <th className="px-3 py-2">Starting Date</th>
              <th className="px-3 py-2">Monthly Rate</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderedTenants.length ? (
              orderedTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  data-tenant-status={tenant.status}
                  className={`border-t border-slate-800 ${tenant.status === "inactive" ? "text-slate-500 opacity-60" : ""}`}
                >
                  <td className="px-3 py-2">{tenant.name}</td>
                  <td className="px-3 py-2">{tenant.lotNo}</td>
                  <td className="px-3 py-2">{tenant.leaseType}</td>
                  <td className="px-3 py-2">{tenant.paymentTerm}</td>
                  <td className="px-3 py-2">{formatDate(tenant.dueDate)}</td>
                  <td className="px-3 py-2">{formatCurrency(tenant.monthlyRate)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onEditTenant(tenant)}
                      className={`rounded px-2 py-1 text-xs ${
                        tenant.status === "inactive"
                          ? "border border-slate-700 hover:bg-slate-800"
                          : "tenant-active-action-edit border border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate-800">
                <td className="px-3 py-3 text-slate-500" colSpan={7}>
                  No tenants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}