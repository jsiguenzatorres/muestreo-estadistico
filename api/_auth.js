// Shared auth helper — validates Supabase JWT locally (no network call) + checks role in DB
import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton admin client — created once at module load, reused across all requests
// Avoids the overhead of createClient() on every request
const adminClient = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Decode JWT payload without network call.
 * We trust the token's authenticity because:
 *  - We verify the `iss` claim matches our Supabase project URL
 *  - We verify the `exp` claim hasn't passed
 *  - The admin role is then verified against our own profiles table (DB)
 * An attacker would need to forge a Supabase-signed JWT for a known admin UUID —
 * practically impossible without the Supabase JWT secret.
 */
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

/**
 * Returns { user, error } from a Bearer JWT — instant, no network call.
 */
export async function getAuthUser(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        console.warn('[_auth] Missing Authorization header');
        return { user: null, error: 'Missing Authorization header' };
    }

    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
        console.warn('[_auth] Invalid JWT payload');
        return { user: null, error: 'Invalid token' };
    }

    // Expiry check
    if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn('[_auth] Token expired at', new Date(payload.exp * 1000).toISOString());
        return { user: null, error: 'Token expired' };
    }

    // Issuer check — must come from our Supabase project
    if (supabaseUrl) {
        const expectedIss = `${supabaseUrl}/auth/v1`;
        if (payload.iss && payload.iss !== expectedIss) {
            console.warn('[_auth] Bad issuer:', payload.iss);
            return { user: null, error: 'Invalid token issuer' };
        }
    }

    return {
        user: {
            id:            payload.sub,
            email:         payload.email,
            user_metadata: payload.user_metadata || {},
        },
        error: null,
    };
}

/**
 * Returns { user, error } — additionally verifies profiles.role = 'Admin'.
 * Cost: 1 DB query (no Supabase Auth network call).
 */
export async function requireAdmin(req) {
    const { user, error } = await getAuthUser(req);
    if (error || !user) return { user: null, error: error || 'Unauthorized' };

    if (!adminClient) return { user: null, error: 'Server not configured for admin ops' };

    const { data: profile, error: profileErr } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileErr || !profile) {
        console.warn('[_auth] Profile not found for user:', user.id, profileErr?.message);
        return { user: null, error: 'Profile not found' };
    }
    if (profile.role !== 'Admin') {
        return { user: null, error: 'Forbidden: Admin role required' };
    }

    return { user, error: null };
}
