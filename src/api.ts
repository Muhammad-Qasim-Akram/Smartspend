export interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: ApiOptions = {}): Promise<T | null> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event('unauth'));
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error: unknown = await response.json();
      if (typeof error === 'string') {
        message = error;
      } else if (typeof error === 'object' && error !== null) {
        const details = error as Record<string, unknown>;
        const candidate = details.message ?? details.title ?? details.error;
        if (typeof candidate === 'string') message = candidate;
      }
    } catch {
      // Keep the generic message when the response has no readable error payload.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null) as Promise<T | null>;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const fmt = (amount: number): string => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;
export const d = (date: string | null | undefined): string => String(date || '').slice(0, 10);
export const today = (): string => new Date().toISOString().slice(0, 10);

export function csv(name: string, rows: Array<Array<string | number>>): void {
  const text = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  anchor.download = name;
  anchor.click();
}
