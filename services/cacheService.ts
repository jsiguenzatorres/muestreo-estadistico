/**
 * Servicio de Cache Inteligente para Análisis de Riesgo
 * Optimiza el rendimiento mediante cache de análisis previos
 */

interface CacheEntry {
    key: string;
    data: any;
    timestamp: number;
    expiresAt: number;
    populationId: string;
    dataHash: string;
}

interface AnalysisCache {
    riskProfile: any;
    analysisData: any;
    scatterData: any[];
    insight: string;
    metadata: {
        totalRows: number;
        processedAt: number;
        version: string;
    };
}

class CacheService {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
    private readonly MAX_CACHE_SIZE = 50; // Máximo 50 análisis en cache
    private readonly STORAGE_KEY = 'aama_risk_analysis_cache';

    constructor() {
        this.loadFromStorage();
        this.startCleanupInterval();
    }

    /**
     * Genera una clave única para el cache basada en la población y configuración
     */
    private generateCacheKey(populationId: string, dataHash: string): string {
        return `risk_analysis_${populationId}_${dataHash}`;
    }

    /**
     * Genera un hash de los datos para detectar cambios
     */
    private generateDataHash(population: any): string {
        const hashData = {
            id: population.id,
            total_rows: population.total_rows,
            column_mapping: population.column_mapping,
            updated_at: population.updated_at
        };
        return btoa(JSON.stringify(hashData)).slice(0, 16);
    }

    /**
     * Verifica si existe un análisis en cache válido
     */
    public hasValidCache(populationId: string, population: any): boolean {
        const dataHash = this.generateDataHash(population);
        const cacheKey = this.generateCacheKey(populationId, dataHash);
        const entry = this.cache.get(cacheKey);

        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(cacheKey);
            return false;
        }

        return true;
    }

    /**
     * Obtiene un análisis del cache
     */
    public getCachedAnalysis(populationId: string, population: any): AnalysisCache | null {
        const dataHash = this.generateDataHash(population);
        const cacheKey = this.generateCacheKey(populationId, dataHash);
        const entry = this.cache.get(cacheKey);

        if (!entry || Date.now() > entry.expiresAt) {
            if (entry) this.cache.delete(cacheKey);
            return null;
        }

        console.log(`🎯 Cache HIT: Análisis recuperado del cache para población ${populationId}`);
        return entry.data as AnalysisCache;
    }

    /**
     * Guarda un análisis en el cache
     */
    public setCachedAnalysis(
        populationId: string, 
        population: any, 
        analysisData: AnalysisCache
    ): void {
        const dataHash = this.generateDataHash(population);
        const cacheKey = this.generateCacheKey(populationId, dataHash);
        const now = Date.now();

        const entry: CacheEntry = {
            key: cacheKey,
            data: analysisData,
            timestamp: now,
            expiresAt: now + this.CACHE_DURATION,
            populationId,
            dataHash
        };

        // Limpiar cache si está lleno
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldestEntries();
        }

        this.cache.set(cacheKey, entry);
        this.saveToStorage();

        console.log(`💾 Cache SET: Análisis guardado en cache para población ${populationId}`);
    }

    /**
     * Elimina entradas más antiguas cuando el cache está lleno
     */
    private evictOldestEntries(): void {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Eliminar el 20% más antiguo
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }

        console.log(`🧹 Cache: Eliminadas ${toRemove} entradas antiguas`);
    }

    /**
     * Limpia entradas expiradas
     */
    private cleanupExpiredEntries(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cache: Limpiadas ${cleaned} entradas expiradas`);
            this.saveToStorage();
        }
    }

    /**
     * Inicia el intervalo de limpieza automática
     */
    private startCleanupInterval(): void {
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

    /**
     * Guarda el cache en localStorage
     */
    private saveToStorage(): void {
        try {
            const cacheData = Array.from(this.cache.entries());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('⚠️ Error guardando cache en localStorage:', error);
        }
    }

    /**
     * Carga el cache desde localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const cacheData = JSON.parse(stored);
                const now = Date.now();

                for (const [key, entry] of cacheData) {
                    // Solo cargar entradas no expiradas
                    if (now <= entry.expiresAt) {
                        this.cache.set(key, entry);
                    }
                }

                console.log(`📦 Cache: Cargadas ${this.cache.size} entradas desde localStorage`);
            }
        } catch (error) {
            console.warn('⚠️ Error cargando cache desde localStorage:', error);
        }
    }

    /**
     * Obtiene estadísticas del cache
     */
    public getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        oldestEntry: number;
        newestEntry: number;
    } {
        const entries = Array.from(this.cache.values());
        const timestamps = entries.map(e => e.timestamp);

        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
            hitRate: 0, // Se calcularía con métricas adicionales
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
        };
    }

    /**
     * Limpia todo el cache
     */
    public clearCache(): void {
        this.cache.clear();
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🧹 Cache: Limpiado completamente');
    }

    /**
     * Invalida cache para una población específica
     */
    public invalidatePopulation(populationId: string): void {
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.populationId === populationId) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            this.saveToStorage();
            console.log(`🗑️ Cache: Invalidadas ${removed} entradas para población ${populationId}`);
        }
    }
}

// Instancia singleton del servicio de cache
export const cacheService = new CacheService();

// Hook personalizado para usar el cache en componentes React
export const useAnalysisCache = () => {
    return {
        hasCache: (populationId: string, population: any) => 
            cacheService.hasValidCache(populationId, population),
        
        getCache: (populationId: string, population: any) => 
            cacheService.getCachedAnalysis(populationId, population),
        
        setCache: (populationId: string, population: any, data: AnalysisCache) => 
            cacheService.setCachedAnalysis(populationId, population, data),
        
        invalidate: (populationId: string) => 
            cacheService.invalidatePopulation(populationId),
        
        clear: () => cacheService.clearCache(),
        
        stats: () => cacheService.getCacheStats()
    };
};