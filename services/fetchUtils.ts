// Utilidades para fetch con timeout y manejo de errores

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

    // 🎯 FIX: En desarrollo, usar API local. En producción, usar Vercel.
    // ANTES: Siempre usaba Vercel cuando hostname === 'localhost' ❌
    // AHORA: Usa API local cuando hostname === 'localhost' ✅
    const useDirectUrl = window.location.hostname !== 'localhost';
    const baseUrl = useDirectUrl ? 'https://analisisinteligente.vercel.app' : '';

    if (requiresPost) {
        url = `${baseUrl}/api/sampling_proxy?action=${action}`;
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            timeout: 15000, // Timeout más corto para detectar problemas rápido
            ...options
        };
    } else {
        const queryParams = new URLSearchParams(params).toString();
        url = `${baseUrl}/api/sampling_proxy?action=${action}&${queryParams}`;
        fetchOptions = {
            timeout: 15000, // Timeout más corto
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