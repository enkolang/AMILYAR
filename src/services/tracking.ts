import { apiClient } from "./api";

export type ConsentChoice = "accepted" | "declined";

const CONSENT_KEY = "am_consent_choice";
const VISITOR_ID_KEY = "am_visitor_id";
const SESSION_ID_KEY = "am_session_id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (raw === "accepted" || raw === "declined") {
    return raw;
  }
  return null;
}

export function setStoredConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CONSENT_KEY, choice);
}

function getOrCreateSessionId() {
  const stored = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (stored) {
    return stored;
  }
  const next = randomId();
  window.sessionStorage.setItem(SESSION_ID_KEY, next);
  return next;
}

function getOrCreateVisitorId() {
  const stored = window.localStorage.getItem(VISITOR_ID_KEY);
  if (stored) {
    return { visitorId: stored, isReturning: true };
  }
  const next = randomId();
  window.localStorage.setItem(VISITOR_ID_KEY, next);
  return { visitorId: next, isReturning: false };
}

function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${window.screen.width}x${window.screen.height}`,
  };
}

export async function trackConsentAccepted() {
  if (typeof window === "undefined") {
    return;
  }
  const { visitorId, isReturning } = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  await apiClient.post("/tracking/consent", {
    visitorId,
    sessionId,
    isReturning,
    deviceInfo: getDeviceInfo(),
  });
}

export async function trackPageView(pageKey: string) {
  if (typeof window === "undefined") {
    return;
  }
  const { visitorId, isReturning } = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  await apiClient.post("/tracking/page-view", {
    visitorId,
    sessionId,
    pageKey,
    pagePath: window.location.pathname,
    isReturning,
    deviceInfo: getDeviceInfo(),
  });
}
