// Shared auth helper — validates Supabase JWT and optionally requires Admin role
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Returns { user, error } — use anon client so we don't bypass RLS for token validation
export async function getAuthUser(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return { user: null, error: 'Missing Authorization header' };
    if (!supabaseUrl || !supabaseAnonKey) return { user: null, error: 'Server auth not configured' };

    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return { user: null, error: error?.message || 'Invalid token' };
    return { user: data.user, error: null };
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
