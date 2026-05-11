
import { createClient } from '@supabase/supabase-js';
import { handlePreflight, setCors } from './_cors.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    setCors(req, res);
    if (handlePreflight(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { rows } = req.body;

        if (!rows || !Array.isArray(rows)) {
            throw new Error('Invalid payload: rows must be an array');
        }

        const { error } = await supabase
            .from('audit_data_rows')
            .insert(rows);

        if (error) throw error;

        return res.status(200).json({ success: true, count: rows.length });

    } catch (error) {
        console.error('[Vercel Batch Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
