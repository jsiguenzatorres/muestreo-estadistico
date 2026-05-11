
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const handler: Handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = JSON.parse(event.body || '{}');
        const { rows } = body;

        if (!rows || !Array.isArray(rows)) {
            throw new Error('Invalid payload: rows must be an array');
        }

        // Insert batch
        const { error } = await supabase
            .from('audit_data_rows')
            .insert(rows);

        if (error) throw error;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, count: rows.length }),
        };

    } catch (error: any) {
        console.error('[Server Batch Error]', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
