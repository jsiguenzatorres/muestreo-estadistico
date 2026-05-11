
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id, column_mapping, advanced_analysis, ai_recommendation } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Construir objeto de actualización dinámicamente
        const updates = {};
        if (column_mapping) updates.column_mapping = column_mapping;
        if (advanced_analysis) updates.advanced_analysis = advanced_analysis;
        if (ai_recommendation) updates.ai_recommendation = ai_recommendation;

        const { data, error } = await supabase
            .from('audit_populations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json(data);

    } catch (error) {
        console.error('[Vercel Update Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
