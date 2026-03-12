export type PushDebugState = {
  permissionStatus: string | null;
  appVariant: string | null;
  projectId: string | null;
  expoToken: string | null;
  sessionUserId: string | null;
  lastRegistrationStatus: "idle" | "success" | "error";
  lastRegistrationError: string | null;
  updatedAt: string | null;
};

const initialState: PushDebugState = {
  permissionStatus: null,
  appVariant: null,
  projectId: null,
  expoToken: null,
  sessionUserId: null,
  lastRegistrationStatus: "idle",
  lastRegistrationError: null,
  updatedAt: null
};

let state: PushDebugState = initialState;
const listeners = new Set<() => void>();

export function getPushDebugState() {
  return state;
}

export function subscribePushDebug(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePushDebugState(partial: Partial<PushDebugState>) {
  state = {
    ...state,
    ...partial,
    updatedAt: new Date().toISOString()
  };
  listeners.forEach((listener) => listener());
}

export function resetPushDebugState() {
  state = {
    ...initialState,
    updatedAt: new Date().toISOString()
  };
  listeners.forEach((listener) => listener());
}
