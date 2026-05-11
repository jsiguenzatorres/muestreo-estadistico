/**
 * Servicio de Logs de Auditoría para AAMA
 * Registra todas las acciones críticas del usuario para compliance y seguridad
 * NOTA: No depende de Supabase - usa almacenamiento local hasta resolver conexión
 */

interface AuditLogEntry {
    id: string;
    timestamp: number;
    userId: string;
    userEmail: string;
    action: AuditAction;
    module: AuditModule;
    details: AuditDetails;
    ipAddress?: string;
    userAgent?: string;
    sessionId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    success: boolean;
    errorMessage?: string;
}

type AuditAction = 
    // Autenticación
    | 'login' | 'logout' | 'login_failed' | 'session_expired'
    // Poblaciones
    | 'population_created' | 'population_updated' | 'population_deleted' | 'population_viewed'
    // Análisis
    | 'analysis_started' | 'analysis_completed' | 'analysis_exported' | 'analysis_shared'
    // Muestreo
    | 'sample_generated' | 'sample_modified' | 'sample_exported' | 'sample_deleted'
    // Reportes
    | 'report_generated' | 'report_downloaded' | 'report_shared' | 'report_deleted'
    // Configuración
    | 'settings_changed' | 'user_created' | 'user_modified' | 'permissions_changed'
    // Sistema
    | 'backup_created' | 'data_imported' | 'data_exported' | 'system_error';

type AuditModule = 
    | 'authentication' | 'populations' | 'risk_analysis' | 'sampling' 
    | 'reports' | 'settings' | 'system' | 'mobile' | 'offline';

interface AuditDetails {
    resourceId?: string;
    resourceName?: string;
    oldValue?: any;
    newValue?: any;
    additionalInfo?: Record<string, any>;
    affectedRecords?: number;
    fileSize?: number;
    duration?: number;
}

interface AuditLogConfig {
    maxLocalEntries: number;
    retentionDays: number;
    enableConsoleLog: boolean;
    enableLocalStorage: boolean;
    enableFileExport: boolean;
    compressionEnabled: boolean;
    sensitiveDataMasking: boolean;
}

class AuditLogService {
    private config: AuditLogConfig = {
        maxLocalEntries: 10000,
        retentionDays: 90,
        enableConsoleLog: true,
        enableLocalStorage: true,
        enableFileExport: true,
        compressionEnabled: true,
        sensitiveDataMasking: true
    };

    private logs: AuditLogEntry[] = [];
    private sessionId: string;
    private readonly STORAGE_KEY = 'aama_audit_logs';
    private readonly SESSION_KEY = 'aama_session_id';

    constructor() {
        this.sessionId = this.generateSessionId();
        this.loadLogsFromStorage();
        this.setupPeriodicCleanup();
        this.logSystemEvent('audit_service_initialized', 'system', {});
        console.log('🔒 Audit Log Service inicializado');
    }

    /**
     * Genera ID único de sesión
     */
    private generateSessionId(): string {
        const existing = sessionStorage.getItem(this.SESSION_KEY);
        if (existing) return existing;

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(this.SESSION_KEY, sessionId);
        return sessionId;
    }

    /**
     * Registra una acción de auditoría
     */
    public logAction(
        action: AuditAction,
        module: AuditModule,
        details: AuditDetails = {},
        severity: AuditLogEntry['severity'] = 'medium',
        success: boolean = true,
        errorMessage?: string
    ): void {
        const entry: AuditLogEntry = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            userId: this.getCurrentUserId(),
            userEmail: this.getCurrentUserEmail(),
            action,
            module,
            details: this.maskSensitiveData(details),
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent,
            sessionId: this.sessionId,
            severity,
            success,
            errorMessage
        };

        this.addLogEntry(entry);
        this.logToConsole(entry);
    }

    /**
     * Registra evento del sistema
     */
    public logSystemEvent(
        action: AuditAction,
        module: AuditModule,
        details: AuditDetails,
        severity: AuditLogEntry['severity'] = 'low'
    ): void {
        this.logAction(action, module, details, severity, true);
    }

    /**
     * Registra error del sistema
     */
    public logError(
        action: AuditAction,
        module: AuditModule,
        error: Error,
        details: AuditDetails = {}
    ): void {
        this.logAction(
            action,
            module,
            {
                ...details,
                errorName: error.name,
                errorStack: error.stack?.substring(0, 500) // Limitar stack trace
            },
            'high',
            false,
            error.message
        );
    }

    /**
     * Registra acción crítica de seguridad
     */
    public logSecurityEvent(
        action: AuditAction,
        details: AuditDetails,
        success: boolean = true
    ): void {
        this.logAction(action, 'authentication', details, 'critical', success);
        
        // Para eventos críticos, también log a console siempre
        console.warn('🚨 SECURITY EVENT:', action, details);
    }

    /**
     * Agrega entrada al log
     */
    private addLogEntry(entry: AuditLogEntry): void {
        this.logs.push(entry);
        
        // Mantener límite de entradas
        if (this.logs.length > this.config.maxLocalEntries) {
            this.logs = this.logs.slice(-this.config.maxLocalEntries);
        }

        // Persistir en localStorage
        if (this.config.enableLocalStorage) {
            this.saveLogsToStorage();
        }
    }

    /**
     * Log a consola para debugging
     */
    private logToConsole(entry: AuditLogEntry): void {
        if (!this.config.enableConsoleLog) return;

        const emoji = this.getSeverityEmoji(entry.severity);
        const timestamp = new Date(entry.timestamp).toISOString();
        
        console.log(
            `${emoji} [${timestamp}] ${entry.action} | ${entry.module} | ${entry.userId}`,
            entry.details
        );
    }

    /**
     * Obtiene emoji según severidad
     */
    private getSeverityEmoji(severity: AuditLogEntry['severity']): string {
        switch (severity) {
            case 'critical': return '🚨';
            case 'high': return '⚠️';
            case 'medium': return 'ℹ️';
            case 'low': return '📝';
            default: return '📋';
        }
    }

    /**
     * Genera ID único para log
     */
    private generateLogId(): string {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtiene ID del usuario actual
     */
    private getCurrentUserId(): string {
        // Por ahora usar sessionStorage, después integrar con auth real
        return sessionStorage.getItem('current_user_id') || 'anonymous';
    }

    /**
     * Obtiene email del usuario actual
     */
    private getCurrentUserEmail(): string {
        // Por ahora usar sessionStorage, después integrar con auth real
        return sessionStorage.getItem('current_user_email') || 'anonymous@local';
    }

    /**
     * Obtiene IP del cliente (simulado por ahora)
     */
    private getClientIP(): string {
        // En producción se obtendría del servidor
        return 'localhost';
    }

    /**
     * Enmascara datos sensibles
     */
    private maskSensitiveData(details: AuditDetails): AuditDetails {
        if (!this.config.sensitiveDataMasking) return details;

        const masked = { ...details };
        
        // Campos sensibles a enmascarar
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'ssn', 'credit_card'];
        
        Object.keys(masked).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                if (typeof masked[key] === 'string') {
                    masked[key] = '***MASKED***';
                }
            }
        });

        return masked;
    }

    /**
     * Carga logs desde localStorage
     */
    private loadLogsFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.logs = Array.isArray(parsed) ? parsed : [];
                console.log(`📋 Cargados ${this.logs.length} logs desde localStorage`);
            }
        } catch (error) {
            console.error('❌ Error cargando logs:', error);
            this.logs = [];
        }
    }

    /**
     * Guarda logs en localStorage
     */
    private saveLogsToStorage(): void {
        try {
            const dataToStore = this.config.compressionEnabled 
                ? this.compressLogs(this.logs)
                : this.logs;
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            console.error('❌ Error guardando logs:', error);
        }
    }

    /**
     * Comprime logs para ahorrar espacio
     */
    private compressLogs(logs: AuditLogEntry[]): any {
        // Comprimir removiendo campos redundantes y acortando strings
        return logs.map(log => ({
            i: log.id.split('_')[1], // Solo timestamp del ID
            t: log.timestamp,
            u: log.userId,
            a: log.action,
            m: log.module,
            d: log.details,
            s: log.severity[0], // Solo primera letra
            ok: log.success,
            e: log.errorMessage
        }));
    }

    /**
     * Descomprime logs
     */
    private decompressLogs(compressedLogs: any[]): AuditLogEntry[] {
        return compressedLogs.map(log => ({
            id: `log_${log.i}_compressed`,
            timestamp: log.t,
            userId: log.u,
            userEmail: 'compressed@local',
            action: log.a,
            module: log.m,
            details: log.d || {},
            sessionId: this.sessionId,
            severity: this.expandSeverity(log.s),
            success: log.ok !== false,
            errorMessage: log.e
        }));
    }

    /**
     * Expande severidad comprimida
     */
    private expandSeverity(compressed: string): AuditLogEntry['severity'] {
        switch (compressed) {
            case 'c': return 'critical';
            case 'h': return 'high';
            case 'm': return 'medium';
            case 'l': return 'low';
            default: return 'medium';
        }
    }

    /**
     * Configura limpieza periódica
     */
    private setupPeriodicCleanup(): void {
        // Limpiar logs antiguos cada hora
        setInterval(() => {
            this.cleanupOldLogs();
        }, 60 * 60 * 1000);
    }

    /**
     * Limpia logs antiguos
     */
    private cleanupOldLogs(): void {
        const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
        const initialCount = this.logs.length;
        
        this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
        
        const cleaned = initialCount - this.logs.length;
        if (cleaned > 0) {
            console.log(`🧹 Limpiados ${cleaned} logs antiguos`);
            this.saveLogsToStorage();
        }
    }

    /**
     * Obtiene logs filtrados
     */
    public getLogs(filters?: {
        module?: AuditModule;
        action?: AuditAction;
        severity?: AuditLogEntry['severity'];
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        success?: boolean;
    }): AuditLogEntry[] {
        let filteredLogs = [...this.logs];

        if (filters) {
            if (filters.module) {
                filteredLogs = filteredLogs.filter(log => log.module === filters.module);
            }
            if (filters.action) {
                filteredLogs = filteredLogs.filter(log => log.action === filters.action);
            }
            if (filters.severity) {
                filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
            }
            if (filters.userId) {
                filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
            }
            if (filters.startDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!.getTime());
            }
            if (filters.endDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!.getTime());
            }
            if (filters.success !== undefined) {
                filteredLogs = filteredLogs.filter(log => log.success === filters.success);
            }
        }

        return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Exporta logs a archivo
     */
    public exportLogs(format: 'json' | 'csv' = 'json'): void {
        if (!this.config.enableFileExport) {
            console.warn('⚠️ Exportación de logs deshabilitada');
            return;
        }

        const logs = this.getLogs();
        const timestamp = new Date().toISOString().split('T')[0];
        
        if (format === 'json') {
            this.downloadFile(
                JSON.stringify(logs, null, 2),
                `aama_audit_logs_${timestamp}.json`,
                'application/json'
            );
        } else {
            const csv = this.convertLogsToCSV(logs);
            this.downloadFile(
                csv,
                `aama_audit_logs_${timestamp}.csv`,
                'text/csv'
            );
        }

        this.logAction('logs_exported', 'system', {
            format,
            recordCount: logs.length,
            exportedBy: this.getCurrentUserId()
        });
    }

    /**
     * Convierte logs a CSV
     */
    private convertLogsToCSV(logs: AuditLogEntry[]): string {
        const headers = [
            'Timestamp', 'User ID', 'User Email', 'Action', 'Module', 
            'Severity', 'Success', 'Resource ID', 'Resource Name', 'Error Message'
        ];

        const rows = logs.map(log => [
            new Date(log.timestamp).toISOString(),
            log.userId,
            log.userEmail,
            log.action,
            log.module,
            log.severity,
            log.success ? 'Yes' : 'No',
            log.details.resourceId || '',
            log.details.resourceName || '',
            log.errorMessage || ''
        ]);

        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    /**
     * Descarga archivo
     */
    private downloadFile(content: string, filename: string, mimeType: string): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Obtiene estadísticas de logs
     */
    public getLogStats(): {
        totalLogs: number;
        logsByModule: Record<AuditModule, number>;
        logsBySeverity: Record<AuditLogEntry['severity'], number>;
        recentErrors: number;
        sessionLogs: number;
    } {
        const logs = this.logs;
        const last24h = Date.now() - (24 * 60 * 60 * 1000);

        return {
            totalLogs: logs.length,
            logsByModule: this.groupBy(logs, 'module'),
            logsBySeverity: this.groupBy(logs, 'severity'),
            recentErrors: logs.filter(log => !log.success && log.timestamp > last24h).length,
            sessionLogs: logs.filter(log => log.sessionId === this.sessionId).length
        };
    }

    /**
     * Agrupa logs por campo
     */
    private groupBy<T extends keyof AuditLogEntry>(
        logs: AuditLogEntry[], 
        field: T
    ): Record<string, number> {
        return logs.reduce((acc, log) => {
            const key = String(log[field]);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    /**
     * Limpia todos los logs
     */
    public clearAllLogs(): void {
        this.logs = [];
        localStorage.removeItem(this.STORAGE_KEY);
        this.logSystemEvent('logs_cleared', 'system', {
            clearedBy: this.getCurrentUserId(),
            timestamp: Date.now()
        });
        console.log('🧹 Todos los logs han sido limpiados');
    }

    /**
     * Actualiza configuración
     */
    public updateConfig(newConfig: Partial<AuditLogConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logSystemEvent('audit_config_updated', 'system', {
            updatedBy: this.getCurrentUserId(),
            newConfig: newConfig
        });
        console.log('⚙️ Configuración de auditoría actualizada');
    }

    /**
     * Obtiene configuración actual
     */
    public getConfig(): AuditLogConfig {
        return { ...this.config };
    }
}

// Instancia singleton del servicio
export const auditLogService = new AuditLogService();

// Hook personalizado para usar audit logs
export const useAuditLog = () => {
    return {
        logAction: (action: AuditAction, module: AuditModule, details?: AuditDetails, severity?: AuditLogEntry['severity']) =>
            auditLogService.logAction(action, module, details, severity),
        
        logError: (action: AuditAction, module: AuditModule, error: Error, details?: AuditDetails) =>
            auditLogService.logError(action, module, error, details),
        
        logSecurity: (action: AuditAction, details: AuditDetails, success?: boolean) =>
            auditLogService.logSecurityEvent(action, details, success),
        
        getLogs: (filters?: any) =>
            auditLogService.getLogs(filters),
        
        exportLogs: (format?: 'json' | 'csv') =>
            auditLogService.exportLogs(format),
        
        getStats: () =>
            auditLogService.getLogStats(),
        
        updateConfig: (config: Partial<AuditLogConfig>) =>
            auditLogService.updateConfig(config)
    };
};

export type { AuditLogEntry, AuditAction, AuditModule, AuditDetails, AuditLogConfig };