// Utilidades para fetch con timeout y manejo de errores
import { supabase } from './supabaseClient';

export interface FetchOptions extends RequestInit {
    timeout?: number;
}

export class FetchTimeoutError extends Error {
    constructor(timeout: number) {
        super(`Request timed out after ${timeout}ms`);
        this.name = 'FetchTimeoutError';
    }
}

export class FetchNetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FetchNetworkError';
    }
}

/**
 * Fetch con timeout automático y manejo de errores mejorado
 */
export async function fetchWithTimeout(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new FetchNetworkError(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new FetchTimeoutError(timeout);
        }

        if (error.message?.includes('Failed to fetch')) {
            throw new FetchNetworkError('No se puede conectar al servidor. Verifique su conexión a internet.');
        }

        throw error;
    }
}

/**
 * Fetch con retry automático
 */
export async function fetchWithRetry(
    url: string,
    options: FetchOptions = {},
    maxRetries: number = 3,
    retryDelay: number = 1000
): Promise<Response> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchWithTimeout(url, options);
        } catch (error: any) {
            lastError = error;

            // No reintentar en errores de timeout o 4xx
            if (error instanceof FetchTimeoutError ||
                (error instanceof FetchNetworkError && error.message.includes('4'))) {
                throw error;
            }

            if (attempt < maxRetries) {
                console.warn(`Intento ${attempt} falló, reintentando en ${retryDelay}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }

    throw lastError!;
}

/**
 * Wrapper específico para llamadas al proxy de sampling
 */
export async function samplingProxyFetch(
    action: string,
    params: Record<string, any> = {},
    options: FetchOptions = {}
): Promise<any> {
    // 🎯 FIX: Detectar automáticamente si debe ser POST
    // Acciones que requieren POST (escriben en BD o tienen objetos complejos)
    // Todas estas acciones están confirmadas en api/sampling_proxy.js
    const POST_ACTIONS = [
        // Operaciones de muestra (sample operations)
        'save_sample',              // Guardar muestra histórica
        'save_work_in_progress',    // Guardar trabajo en progreso
        'calculate_sample',         // Cálculo de muestra server-side

        // Operaciones de auditoría (audit operations)
        'create_audit',             // Crear auditoría (legacy)
        'update_audit',             // Actualizar auditoría (legacy)

        // Operaciones de población (population operations)
        'delete_population',        // Eliminar población

        // Operaciones de usuario (user operations)
        'create_user',              // Crear usuario (admin) — POST con payload JSON
        'delete_user',              // Eliminar usuario (admin)
        'toggle_user_status',       // Cambiar estado de usuario

        // Operaciones de observaciones (observation operations)
        'save_observation',         // Guardar/actualizar observación
        'delete_observation',       // Eliminar observación

        // Operaciones de datos (data operations)
        'sync_chunk',               // Sincronizar chunk de datos
        'get_rows_batch',           // Obtener batch de filas (usa POST por payload grande)
    ];
    const requiresPost = POST_ACTIONS.includes(action) || options.method === 'POST' || params.body;

    let url: string;
    let fetchOptions: FetchOptions;

    // Siempre usar URL relativa — el servidor Express en el VPS maneja /api/*
    const baseUrl = '';

    // Incluir JWT del usuario autenticado
    // Allow up to 8s for getSession — covers token-refresh scenarios on page reload
    let accessToken: string | null = null;
    try {
        const session = await Promise.race([
            supabase.auth.getSession().then(r => r.data.session),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 8000))
        ]);
        accessToken = session?.access_token ?? null;
    } catch { /* continuar */ }

    // Fallback: si el cliente Supabase aún no inicializó su caché interna,
    // leer el token directamente de localStorage (misma fuente que usa el fast-path de AuthContext)
    if (!accessToken) {
        try {
            const cachedKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
            if (cachedKey) {
                const cached = JSON.parse(localStorage.getItem(cachedKey) || '{}');
                if (cached?.access_token && cached?.expires_at && cached.expires_at * 1000 > Date.now()) {
                    accessToken = cached.access_token;
                }
            }
        } catch { /* ignorar errores de parse */ }
    }

    const authHeader = accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {};

    // Admin operations that involve multiple sequential Supabase calls (auth + DB + email) need a longer timeout
    const ADMIN_ACTIONS = ['create_user', 'delete_user', 'toggle_user_status', 'get_users'];
    const defaultTimeout = ADMIN_ACTIONS.includes(action) ? 45000 : 15000;

    if (requiresPost) {
        url = `${baseUrl}/api/sampling_proxy?action=${action}`;
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify(params),
            timeout: defaultTimeout,
            ...options
        };
    } else {
        const queryParams = new URLSearchParams(params).toString();
        url = `${baseUrl}/api/sampling_proxy?action=${action}&${queryParams}`;
        fetchOptions = {
            headers: { ...authHeader },
            timeout: defaultTimeout,
            ...options
        };
    }

    console.log(`🌐 Llamando: ${url}`);

    try {
        const response = await fetchWithRetry(url, fetchOptions, 2, 2000);
        const result = await response.json();
        console.log(`✅ Respuesta recibida para ${action}`);
        return result;
    } catch (error) {
        console.error(`❌ Error en ${action}:`, error);
        throw error;
    }
}