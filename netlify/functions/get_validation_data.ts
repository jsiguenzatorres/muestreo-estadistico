
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const handler: Handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const id = event.queryStringParameters?.id;

    if (!id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing population ID' }),
        };
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

        // 2. Fetch Rows (Limit to 2000 for safety, though pagination is better eventually)
        const { data: rows, error: rowsError } = await supabase
            .from('audit_data_rows')
            .select('*')
            .eq('population_id', id)
            .limit(2000);

        if (rowsError) throw rowsError;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ population, rows }),
        };

    } catch (error: any) {
        console.error('[Server Read Error]', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
