
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

        // 1. Fetch Population
        const { data: population, error: popError } = await supabase
            .from('audit_populations')
            .select('*')
            .eq('id', id)
            .single();

        if (popError) throw popError;

        // 2. Fetch Rows
        const { data: rows, error: rowsError } = await supabase
            .from('audit_data_rows')
            .select('*')
            .eq('population_id', id)
            .limit(2000);

        if (rowsError) throw rowsError;

        return res.status(200).json({ population, rows });

    } catch (error) {
        console.error('[Vercel Read Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
