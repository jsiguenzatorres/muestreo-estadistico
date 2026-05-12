// Shared auth helper — validates Supabase JWT and optionally requires Admin role
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Returns { user, error } — validates JWT via Supabase Auth API with 30s timeout
export async function getAuthUser(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        console.warn('[_auth] 401 — Missing Authorization header');
        return { user: null, error: 'Missing Authorization header' };
    }
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[_auth] 401 — Server auth not configured (missing SUPABASE_URL or VITE_SUPABASE_ANON_KEY)');
        return { user: null, error: 'Server auth not configured' };
    }

    // Quick local decode to check expiry before making a network call
    try {
        const payloadB64 = token.split('.')[1];
        if (payloadB64) {
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                console.warn('[_auth] 401 — JWT is expired (exp:', new Date(payload.exp * 1000).toISOString(), ')');
                return { user: null, error: 'Token expired' };
            }
            console.log('[_auth] Token pre-check OK, sub:', payload.sub, 'exp:', new Date(payload.exp * 1000).toISOString());
        }
    } catch { /* ignore decode errors, let Supabase validate */ }

    // Use service role key for auth validation — same endpoint but avoids RLS concerns
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const keyToUse = supabaseServiceKey || supabaseAnonKey;
    const client = createClient(supabaseUrl, keyToUse);

    // 30s timeout — Supabase free tier can take 10-20s to wake from cold start
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timed out after 30s')), 30000)
    );

    try {
        const { data, error } = await Promise.race([
            client.auth.getUser(token),
            timeout
        ]);
        if (error || !data?.user) {
            console.warn('[_auth] 401 — getUser returned error:', error?.message || '(no user in response)');
            return { user: null, error: error?.message || 'Invalid token' };
        }
        return { user: data.user, error: null };
    } catch (err) {
        console.error('[_auth] 401 — getUser threw:', err.message);
        return { user: null, error: err.message || 'Auth check failed' };
    }
}

// Returns { user, error } — additionally checks profiles.role = 'Admin'
export async function requireAdmin(req) {
    const { user, error } = await getAuthUser(req);
    if (error || !user) return { user: null, error: error || 'Unauthorized' };

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) return { user: null, error: 'Server not configured for admin ops' };

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileErr } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileErr || !profile) return { user: null, error: 'Profile not found' };
    if (profile.role !== 'Admin') return { user: null, error: 'Forbidden: Admin role required' };

    return { user, error: null };
}
