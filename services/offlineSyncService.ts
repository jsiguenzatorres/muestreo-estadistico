/**
 * Servicio de Sincronización Offline para Trabajo en Campo
 * Maneja cache offline, sincronización automática y trabajo sin conexión
 */

interface OfflineData {
    id: string;
    type: 'analysis' | 'population' | 'report' | 'sample';
    data: any;
    timestamp: number;
    lastModified: number;
    syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
    retryCount: number;
    priority: 'high' | 'medium' | 'low';
}

interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete';
    endpoint: string;
    data: any;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
}

interface OfflineConfig {
    maxStorageSize: number; // MB
    syncInterval: number; // ms
    maxRetries: number;
    compressionEnabled: boolean;
    autoSync: boolean;
    backgroundSync: boolean;
}

class OfflineSyncService {
    private config: OfflineConfig = {
        maxStorageSize: 100, // 100MB
        syncInterval: 30000, // 30 segundos
        maxRetries: 3,
        compressionEnabled: true,
        autoSync: true,
        backgroundSync: true
    };

    private offlineStorage: Map<string, OfflineData> = new Map();
    private syncQueue: SyncQueueItem[] = [];
    private isOnline: boolean = navigator.onLine;
    private syncInterval: NodeJS.Timeout | null = null;
    private syncCallbacks: Map<string, (status: any) => void> = new Map();

    private readonly STORAGE_KEY = 'aama_offline_data';
    private readonly SYNC_QUEUE_KEY = 'aama_sync_queue';

    constructor() {
        this.initializeOfflineStorage();
        this.setupNetworkListeners();
        this.startSyncInterval();
        console.log('🔄 Offline Sync Service inicializado');
    }

    /**
     * Inicializa almacenamiento offline
     */
    private initializeOfflineStorage(): void {
        try {
            // Cargar datos offline desde localStorage
            const storedData = localStorage.getItem(this.STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                for (const [key, value] of Object.entries(parsedData)) {
                    this.offlineStorage.set(key, value as OfflineData);
                }
                console.log(`📦 Cargados ${this.offlineStorage.size} elementos offline`);
            }

            // Cargar cola de sincronización
            const storedQueue = localStorage.getItem(this.SYNC_QUEUE_KEY);
            if (storedQueue) {
                this.syncQueue = JSON.parse(storedQueue);
                console.log(`📋 Cargados ${this.syncQueue.length} elementos en cola de sync`);
            }
        } catch (error) {
            console.error('❌ Error cargando datos offline:', error);
        }
    }

    /**
     * Configura listeners de red
     */
    private setupNetworkListeners(): void {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Conexión restaurada - iniciando sincronización');
            this.syncPendingData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 Sin conexión - modo offline activado');
        });
    }

    /**
     * Inicia intervalo de sincronización
     */
    private startSyncInterval(): void {
        if (this.config.autoSync) {
            this.syncInterval = setInterval(() => {
                if (this.isOnline) {
                    this.syncPendingData();
                }
            }, this.config.syncInterval);
        }
    }

    /**
     * Guarda datos para uso offline
     */
    public saveOfflineData(
        id: string,
        type: OfflineData['type'],
        data: any,
        priority: OfflineData['priority'] = 'medium'
    ): void {
        const offlineData: OfflineData = {
            id,
            type,
            data: this.config.compressionEnabled ? this.compressData(data) : data,
            timestamp: Date.now(),
            lastModified: Date.now(),
            syncStatus: 'pending',
            retryCount: 0,
            priority
        };

        this.offlineStorage.set(id, offlineData);
        this.persistToStorage();

        console.log(`💾 Datos guardados offline: ${id} (${type})`);

        // Intentar sincronizar inmediatamente si hay conexión
        if (this.isOnline && this.config.autoSync) {
            this.syncItem(id);
        }
    }

    /**
     * Obtiene datos offline
     */
    public getOfflineData(id: string): any | null {
        const item = this.offlineStorage.get(id);
        if (!item) return null;

        return this.config.compressionEnabled 
            ? this.decompressData(item.data) 
            : item.data;
    }

    /**
     * Lista todos los datos offline
     */
    public listOfflineData(type?: OfflineData['type']): OfflineData[] {
        const items = Array.from(this.offlineStorage.values());
        return type ? items.filter(item => item.type === type) : items;
    }

    /**
     * Agrega operación a la cola de sincronización
     */
    public queueSync(
        id: string,
        action: SyncQueueItem['action'],
        endpoint: string,
        data: any
    ): void {
        const queueItem: SyncQueueItem = {
            id,
            action,
            endpoint,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: this.config.maxRetries
        };

        this.syncQueue.push(queueItem);
        this.persistSyncQueue();

        console.log(`📋 Operación agregada a cola de sync: ${action} ${endpoint}`);

        // Intentar sincronizar inmediatamente si hay conexión
        if (this.isOnline && this.config.autoSync) {
            this.processSyncQueue();
        }
    }

    /**
     * Sincroniza elemento específico
     */
    private async syncItem(id: string): Promise<void> {
        const item = this.offlineStorage.get(id);
        if (!item || item.syncStatus === 'synced') return;

        item.syncStatus = 'syncing';
        
        try {
            // Simular sincronización con servidor
            await this.uploadToServer(item);
            
            item.syncStatus = 'synced';
            item.lastModified = Date.now();
            
            console.log(`✅ Sincronizado: ${id}`);
            this.notifySyncStatus(id, 'success', item);
            
        } catch (error) {
            item.syncStatus = 'error';
            item.retryCount++;
            
            console.error(`❌ Error sincronizando ${id}:`, error);
            this.notifySyncStatus(id, 'error', { error, item });
        }

        this.persistToStorage();
    }

    /**
     * Sincroniza todos los datos pendientes
     */
    public async syncPendingData(): Promise<void> {
        const pendingItems = Array.from(this.offlineStorage.values())
            .filter(item => item.syncStatus === 'pending' || item.syncStatus === 'error')
            .sort((a, b) => {
                // Priorizar por importancia y timestamp
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
            });

        console.log(`🔄 Sincronizando ${pendingItems.length} elementos pendientes`);

        for (const item of pendingItems) {
            if (item.retryCount < this.config.maxRetries) {
                await this.syncItem(item.id);
                
                // Pequeña pausa entre sincronizaciones
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Procesar cola de sincronización
        await this.processSyncQueue();
    }

    /**
     * Procesa cola de sincronización
     */
    private async processSyncQueue(): Promise<void> {
        const queue = [...this.syncQueue];
        
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            
            try {
                await this.executeSync(item);
                
                // Remover de la cola si fue exitoso
                this.syncQueue.splice(this.syncQueue.indexOf(item), 1);
                console.log(`✅ Sincronización completada: ${item.action} ${item.endpoint}`);
                
            } catch (error) {
                item.retryCount++;
                
                if (item.retryCount >= item.maxRetries) {
                    // Remover si excedió reintentos
                    this.syncQueue.splice(this.syncQueue.indexOf(item), 1);
                    console.error(`❌ Sincronización falló definitivamente: ${item.id}`, error);
                } else {
                    console.warn(`⚠️ Reintentando sincronización: ${item.id} (${item.retryCount}/${item.maxRetries})`);
                }
            }
        }

        this.persistSyncQueue();
    }

    /**
     * Ejecuta sincronización individual
     */
    private async executeSync(item: SyncQueueItem): Promise<void> {
        const options: RequestInit = {
            method: item.action === 'delete' ? 'DELETE' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (item.action !== 'delete') {
            options.body = JSON.stringify(item.data);
        }

        const response = await fetch(item.endpoint, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Simula subida al servidor
     */
    private async uploadToServer(item: OfflineData): Promise<void> {
        // En producción, aquí iría la lógica real de subida
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simular éxito/fallo aleatorio para testing
                if (Math.random() > 0.1) { // 90% éxito
                    resolve();
                } else {
                    reject(new Error('Simulated network error'));
                }
            }, 1000 + Math.random() * 2000); // 1-3 segundos
        });
    }

    /**
     * Comprime datos para almacenamiento
     */
    private compressData(data: any): string {
        try {
            return btoa(JSON.stringify(data));
        } catch (error) {
            console.warn('⚠️ Error comprimiendo datos:', error);
            return JSON.stringify(data);
        }
    }

    /**
     * Descomprime datos
     */
    private decompressData(compressedData: string): any {
        try {
            return JSON.parse(atob(compressedData));
        } catch (error) {
            console.warn('⚠️ Error descomprimiendo datos:', error);
            return JSON.parse(compressedData);
        }
    }

    /**
     * Persiste datos en localStorage
     */
    private persistToStorage(): void {
        try {
            const dataToStore = Object.fromEntries(this.offlineStorage.entries());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            console.error('❌ Error persistiendo datos offline:', error);
        }
    }

    /**
     * Persiste cola de sincronización
     */
    private persistSyncQueue(): void {
        try {
            localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('❌ Error persistiendo cola de sync:', error);
        }
    }

    /**
     * Notifica estado de sincronización
     */
    private notifySyncStatus(id: string, status: 'success' | 'error', data: any): void {
        for (const callback of this.syncCallbacks.values()) {
            try {
                callback({ id, status, data, timestamp: Date.now() });
            } catch (error) {
                console.error('Error en callback de sync:', error);
            }
        }
    }

    /**
     * Registra callback para notificaciones de sync
     */
    public onSyncStatus(id: string, callback: (status: any) => void): void {
        this.syncCallbacks.set(id, callback);
    }

    /**
     * Desregistra callback de sync
     */
    public offSyncStatus(id: string): void {
        this.syncCallbacks.delete(id);
    }

    /**
     * Verifica si hay conexión
     */
    public isOnlineStatus(): boolean {
        return this.isOnline;
    }

    /**
     * Obtiene estadísticas de sincronización
     */
    public getSyncStats(): {
        totalItems: number;
        pendingSync: number;
        syncedItems: number;
        errorItems: number;
        queueSize: number;
        storageUsed: number;
    } {
        const items = Array.from(this.offlineStorage.values());
        
        return {
            totalItems: items.length,
            pendingSync: items.filter(i => i.syncStatus === 'pending').length,
            syncedItems: items.filter(i => i.syncStatus === 'synced').length,
            errorItems: items.filter(i => i.syncStatus === 'error').length,
            queueSize: this.syncQueue.length,
            storageUsed: this.calculateStorageSize()
        };
    }

    /**
     * Calcula tamaño de almacenamiento usado
     */
    private calculateStorageSize(): number {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY) || '';
            const queue = localStorage.getItem(this.SYNC_QUEUE_KEY) || '';
            return (data.length + queue.length) / 1024 / 1024; // MB
        } catch {
            return 0;
        }
    }

    /**
     * Limpia datos antiguos
     */
    public cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { // 7 días
        const now = Date.now();
        let cleaned = 0;

        for (const [id, item] of this.offlineStorage.entries()) {
            if (item.syncStatus === 'synced' && (now - item.lastModified) > maxAge) {
                this.offlineStorage.delete(id);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.persistToStorage();
            console.log(`🧹 Limpiados ${cleaned} elementos offline antiguos`);
        }
    }

    /**
     * Fuerza sincronización manual
     */
    public async forcSync(): Promise<void> {
        console.log('🔄 Forzando sincronización manual...');
        await this.syncPendingData();
    }

    /**
     * Actualiza configuración
     */
    public updateConfig(newConfig: Partial<OfflineConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Reiniciar intervalo si cambió
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.startSyncInterval();
        }
        
        console.log('⚙️ Configuración offline actualizada:', this.config);
    }

    /**
     * Obtiene configuración actual
     */
    public getConfig(): OfflineConfig {
        return { ...this.config };
    }
}

// Instancia singleton del servicio
export const offlineSyncService = new OfflineSyncService();

// Hook personalizado para usar sincronización offline
export const useOfflineSync = () => {
    return {
        isOnline: offlineSyncService.isOnlineStatus(),
        stats: offlineSyncService.getSyncStats(),
        
        saveOffline: (id: string, type: OfflineData['type'], data: any, priority?: OfflineData['priority']) =>
            offlineSyncService.saveOfflineData(id, type, data, priority),
        
        getOffline: (id: string) =>
            offlineSyncService.getOfflineData(id),
        
        listOffline: (type?: OfflineData['type']) =>
            offlineSyncService.listOfflineData(type),
        
        queueSync: (id: string, action: SyncQueueItem['action'], endpoint: string, data: any) =>
            offlineSyncService.queueSync(id, action, endpoint, data),
        
        forceSync: () =>
            offlineSyncService.forcSync(),
        
        onSyncStatus: (id: string, callback: (status: any) => void) =>
            offlineSyncService.onSyncStatus(id, callback),
        
        offSyncStatus: (id: string) =>
            offlineSyncService.offSyncStatus(id),
        
        cleanup: (maxAge?: number) =>
            offlineSyncService.cleanupOldData(maxAge),
        
        updateConfig: (config: Partial<OfflineConfig>) =>
            offlineSyncService.updateConfig(config)
    };
};

export type { OfflineData, SyncQueueItem, OfflineConfig };