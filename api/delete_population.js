
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, setCors } from './_cors.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    setCors(req, res);
    if (handlePreflight(req, res)) return;

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Missing population ID' });
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error } = await supabase
            .from('audit_populations')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[Vercel Delete Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
