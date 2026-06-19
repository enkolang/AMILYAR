import type { TenantLeaseType } from "../types";

export const leaseTypeOptions: TenantLeaseType[] = ["House", "Lot", "Parking Car", "Parking Motor"];

export function isParkingLeaseType(leaseType: TenantLeaseType): boolean {
  return leaseType === "Parking Car" || leaseType === "Parking Motor";
}

export function isResidentialLeaseType(leaseType: TenantLeaseType): boolean {
  return leaseType === "House" || leaseType === "Lot";
}

export function getLeaseTypeGroup(leaseType: TenantLeaseType): "Residential" | "Parking" {
  return isParkingLeaseType(leaseType) ? "Parking" : "Residential";
}

export function normalizeLeaseTypeInput(rawValue: string): TenantLeaseType | "" {
  const normalized = rawValue.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "house" || normalized === "residential") {
    return "House";
  }
  if (normalized === "lot") {
    return "Lot";
  }
  if (normalized === "parking" || normalized === "parkingcar") {
    return "Parking Car";
  }
  if (normalized === "parkingmotor" || normalized === "motorparking" || normalized === "motor") {
    return "Parking Motor";
  }
  return "";
}