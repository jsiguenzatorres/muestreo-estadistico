const cleanEnv = (val: string | undefined) => {
    if (!val) return '';
    let clean = val.trim();
    if (clean.startsWith("'") && clean.endsWith("'")) clean = clean.slice(1, -1);
    if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);
    return clean;
};

// PROXY MODE ACTIVADO: Usamos el proxy local para evitar bloqueos del navegador
// MODO DIRECTO (Vercel): Usamos la conexión directa para Auth y Lecturas normales.
// Las escrituras pesadas usarán el Backend Proxy en /api
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_CONFIG = {
    // URL del proyecto Supabase (cargada desde variables de entorno)
    url: cleanEnv(SUPABASE_URL),

    // Clave anónima (anon key) (cargada desde variables de entorno)
    apiKey: cleanEnv(SUPABASE_ANON_KEY),

    // Usuario de base de datos dedicado y de solo lectura para auditoría.
    user: 'auditor',
};
