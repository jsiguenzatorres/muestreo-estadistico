import { createClient } from '@supabase/supabase-js';
import { handlePreflight, setCors } from './_cors.js';
import { requireAdmin } from './_auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    setCors(req, res);
    if (handlePreflight(req, res)) return;

    const { user, error: authError } = await requireAdmin(req);
    if (authError) return res.status(authError === 'Forbidden: Admin role required' ? 403 : 401).json({ error: authError });

    try {
        if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        return res.status(200).json({ users });
    } catch (error) {
        console.error('[Admin Users Proxy Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
