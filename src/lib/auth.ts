export interface AuthUser {
  id: string;
  name: string;
  role: "admin" | "viewer";
}

const AUTH_KEY = "sg_auth_v1";

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

// SHA-256 via Web Crypto API — identical to pgcrypto encode(digest(input,'sha256'),'hex')
export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
