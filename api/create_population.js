
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // CORS
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
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Vercel auto-parses JSON body
        const body = req.body;
        const {
            file_name,
            audit_name,
            area,
            status,
            user_id,
            upload_timestamp,
            total_rows,
            total_monetary_value,
            descriptive_stats,
            column_mapping
        } = body;

        console.log(`[Vercel] Creating population for: ${file_name}`);

        const { data, error } = await supabase
            .from('audit_populations')
            .insert([{
                file_name,
                audit_name,
                area,
                status,
                user_id,
                upload_timestamp,
                total_rows,
                total_monetary_value,
                descriptive_stats,
                column_mapping
            }])
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json(data);

    } catch (error) {
        console.error('[Vercel Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
