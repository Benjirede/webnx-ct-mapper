const SECRET = process.env.AUTH_SECRET || 'webnx-ct-floor-pilot-secret-key-2026';

export interface SessionPayload {
  username: string;
  role: string;
  exp: number;
}

async function getCryptoKey() {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(username: string, role: string): Promise<string> {
  const payload: SessionPayload = {
    username,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14-day pilot session
  };
  const data = btoa(JSON.stringify(payload));
  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${sigBase64}`;
}

export async function verifySession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const [data, sigBase64] = token.split('.');
  if (!data || !sigBase64) return null;

  try {
    const key = await getCryptoKey();
    const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(atob(data));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
