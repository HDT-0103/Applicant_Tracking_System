// --- Returning-candidate memory ----------------------------------------------
// Candidates have no account, so the only way to recognise "the same person
// came back to this job" is this browser's localStorage. After a successful
// submission we remember the application's ids per job; on the next visit the
// careers form loads that application and switches to edit mode.
//
// Limits by design: a different browser/device (or cleared storage) is treated
// as a new applicant. Kept free of React so it can be unit-tested.

const STORAGE_KEY = "smartats_my_applications";

export interface StoredApplicationRef {
  applicationId: string;
  candidateUuid: string;
  resumeId: string;
  submittedAt: string;
}

type StoreShape = Record<string, StoredApplicationRef>;

function readStore(): StoreShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode, quota) — the feature degrades to the
    // plain new-application flow, which is safe.
  }
}

export function readStoredApplication(jobId: string): StoredApplicationRef | null {
  const entry = readStore()[jobId];
  return entry && entry.applicationId && entry.candidateUuid ? entry : null;
}

export function writeStoredApplication(jobId: string, ref: StoredApplicationRef): void {
  const store = readStore();
  store[jobId] = ref;
  writeStore(store);
}

export function clearStoredApplication(jobId: string): void {
  const store = readStore();
  if (jobId in store) {
    delete store[jobId];
    writeStore(store);
  }
}
