
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Server-Side)
// Note: These must be set in Netlify Environment Variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const handler: Handler = async (event, context) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: 'Method Not Allowed'
        };
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase Server Configuration (URL or Service Key)');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = JSON.parse(event.body || '{}');
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

        console.log(`[Server] Creating population for file: ${file_name}`);

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

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data),
        };

    } catch (error: any) {
        console.error('[Server Error]', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
