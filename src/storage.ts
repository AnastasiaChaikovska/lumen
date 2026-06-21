import type { ApplicationRecord, SessionData } from "./types";

const SESSION_KEY = "lumen.session.v1";
const APPLICATIONS_KEY = "lumen.applications.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSession(): SessionData | null {
  return readJson<SessionData | null>(SESSION_KEY, null);
}

export function saveSession(session: SessionData) {
  writeJson(SESSION_KEY, session);
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function loadApplications(): ApplicationRecord[] {
  return readJson<ApplicationRecord[]>(APPLICATIONS_KEY, []);
}

export function saveApplications(applications: ApplicationRecord[]) {
  writeJson(APPLICATIONS_KEY, applications);
}
