// No token handling here on purpose: the JWT lives in an HttpOnly cookie the browser sends itself.
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('unauth'));
  if (!r.ok) { let m = 'Something went wrong'; try { const j = await r.json(); m = j.message || j.title || j.error || (typeof j === 'string' ? j : m) } catch { } throw new Error(m) }
  return r.status === 204 ? null : r.json().catch(() => null);
}
export const fmt = n => 'Rs ' + Number(n || 0).toLocaleString('en-US');
export const d = s => String(s || '').slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export function csv(name, rows) { const t = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = name; a.click(); }
