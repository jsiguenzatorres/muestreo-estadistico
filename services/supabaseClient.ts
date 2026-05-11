
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';

const supabaseUrl = SUPABASE_CONFIG.url;
const supabaseKey = SUPABASE_CONFIG.apiKey;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase credentials missing! Check .env file. Using placeholders to prevent app crash.");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
);
