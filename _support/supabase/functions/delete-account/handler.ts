export interface AccountDeletionBackend {
  userId(token: string): Promise<string | null>;
  revokeSessions(token: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export function createAccountDeletionHandler(backend: AccountDeletionBackend) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const reply = (body: object, status = 200) => Response.json(body, { status, headers });
    if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
    const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply({ error: 'Sign in first' }, 401);
    try {
      // Identity comes exclusively from Auth, never from a request body or decoded JWT.
      const userId = await backend.userId(token);
      if (!userId) return reply({ error: 'Sign in again before deleting your account' }, 401);
      // Revoke refresh sessions first. Existing access JWTs expire normally; deleting
      // auth.users cascades owned rows and prevents recreating them via their FKs.
      await backend.revokeSessions(token);
      await backend.deleteUser(userId);
      return reply({ deleted: true });
    } catch {
      // Never log authorization headers or return internal service errors.
      return reply({ error: 'Could not delete your account. Please retry or sign in again.' }, 503);
    }
  };
}
