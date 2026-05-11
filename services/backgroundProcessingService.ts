/**
 * Servicio de Procesamiento en Background con Notificaciones
 * Maneja tareas pesadas en segundo plano con feedback al usuario
 */

interface BackgroundTask {
    id: string;
    type: 'risk_analysis' | 'data_processing' | 'report_generation' | 'cache_update';
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startTime: number;
    endTime?: number;
    data: any;
    result?: any;
    error?: string;
    priority: 'high' | 'medium' | 'low';
    estimatedDuration: number;
    actualDuration?: number;
}

interface TaskProgress {
    taskId: string;
    progress: number;
    message: string;
    stage: string;
    estimatedTimeRemaining: number;
}

interface NotificationConfig {
    showProgress: boolean;
    showCompletion: boolean;
    showErrors: boolean;
    autoHide: boolean;
    hideDelay: number;
}

class BackgroundProcessingService {
    private tasks: Map<string, BackgroundTask> = new Map();
    private workers: Map<string, Worker> = new Map();
    private maxConcurrentTasks = 3;
    private runningTasks = 0;
    private taskQueue: string[] = [];
    private notificationCallbacks: Map<string, (notification: any) => void> = new Map();

    private defaultNotificationConfig: NotificationConfig = {
        showProgress: true,
        showCompletion: true,
        showErrors: true,
        autoHide: true,
        hideDelay: 5000
    };

    constructor() {
        this.initializeWorkers();
    }

    /**
     * Inicializa workers para diferentes tipos de tareas
     */
    private initializeWorkers(): void {
        // En un entorno real, aquí se inicializarían Web Workers
        // Por ahora simulamos con setTimeout para el procesamiento asíncrono
        console.log('🔧 Background Processing: Servicio inicializado');
    }

    /**
     * Genera un ID único para la tarea
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Agrega una tarea al procesamiento en background
     */
    public addTask(
        type: BackgroundTask['type'],
        data: any,
        priority: BackgroundTask['priority'] = 'medium',
        estimatedDuration: number = 30000 // 30 segundos por defecto
    ): string {
        const taskId = this.generateTaskId();
        
        const task: BackgroundTask = {
            id: taskId,
            type,
            status: 'queued',
            progress: 0,
            startTime: Date.now(),
            data,
            priority,
            estimatedDuration
        };

        this.tasks.set(taskId, task);
        this.taskQueue.push(taskId);
        
        // Ordenar cola por prioridad
        this.sortTaskQueue();
        
        // Intentar procesar la tarea inmediatamente
        this.processNextTask();

        console.log(`📋 Tarea agregada: ${taskId} (${type}, prioridad: ${priority})`);
        
        // Notificar que la tarea fue agregada
        this.notifyTaskQueued(task);

        return taskId;
    }

    /**
     * Ordena la cola de tareas por prioridad
     */
    private sortTaskQueue(): void {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        
        this.taskQueue.sort((a, b) => {
            const taskA = this.tasks.get(a);
            const taskB = this.tasks.get(b);
            
            if (!taskA || !taskB) return 0;
            
            return priorityOrder[taskB.priority] - priorityOrder[taskA.priority];
        });
    }

    /**
     * Procesa la siguiente tarea en la cola
     */
    private async processNextTask(): Promise<void> {
        if (this.runningTasks >= this.maxConcurrentTasks || this.taskQueue.length === 0) {
            return;
        }

        const taskId = this.taskQueue.shift();
        if (!taskId) return;

        const task = this.tasks.get(taskId);
        if (!task) return;

        this.runningTasks++;
        task.status = 'running';
        task.startTime = Date.now();

        console.log(`🚀 Procesando tarea: ${taskId} (${task.type})`);
        
        // Notificar inicio de tarea
        this.notifyTaskStarted(task);

        try {
            await this.executeTask(task);
            
            task.status = 'completed';
            task.endTime = Date.now();
            task.actualDuration = task.endTime - task.startTime;
            task.progress = 100;

            console.log(`✅ Tarea completada: ${taskId} en ${task.actualDuration}ms`);
            
            // Notificar completación
            this.notifyTaskCompleted(task);

        } catch (error) {
            task.status = 'failed';
            task.endTime = Date.now();
            task.error = error instanceof Error ? error.message : 'Error desconocido';

            console.error(`❌ Tarea falló: ${taskId}`, error);
            
            // Notificar error
            this.notifyTaskFailed(task);

        } finally {
            this.runningTasks--;
            
            // Procesar siguiente tarea
            setTimeout(() => this.processNextTask(), 100);
        }
    }

    /**
     * Ejecuta una tarea específica según su tipo
     */
    private async executeTask(task: BackgroundTask): Promise<void> {
        switch (task.type) {
            case 'risk_analysis':
                await this.executeRiskAnalysis(task);
                break;
            case 'data_processing':
                await this.executeDataProcessing(task);
                break;
            case 'report_generation':
                await this.executeReportGeneration(task);
                break;
            case 'cache_update':
                await this.executeCacheUpdate(task);
                break;
            default:
                throw new Error(`Tipo de tarea no soportado: ${task.type}`);
        }
    }

    /**
     * Ejecuta análisis de riesgo en background
     */
    private async executeRiskAnalysis(task: BackgroundTask): Promise<void> {
        const { populationId, rows } = task.data;
        const totalSteps = 5;
        let currentStep = 0;

        // Simular procesamiento por etapas
        const stages = [
            'Cargando datos de población',
            'Ejecutando análisis forense',
            'Calculando scores de riesgo',
            'Generando métricas avanzadas',
            'Finalizando análisis'
        ];

        for (const stage of stages) {
            currentStep++;
            task.progress = (currentStep / totalSteps) * 100;
            
            this.notifyTaskProgress(task, stage);
            
            // Simular trabajo pesado
            await this.simulateHeavyWork(task.estimatedDuration / totalSteps);
        }

        // Resultado simulado
        task.result = {
            riskProfile: { totalRiskScore: 45.7, gapAlerts: 12 },
            analysisData: { /* datos del análisis */ },
            scatterData: [],
            insight: 'Análisis completado en background'
        };
    }

    /**
     * Ejecuta procesamiento de datos en background
     */
    private async executeDataProcessing(task: BackgroundTask): Promise<void> {
        const { data, operation } = task.data;
        const totalItems = data.length;
        const batchSize = 100;
        let processedItems = 0;

        while (processedItems < totalItems) {
            const batch = data.slice(processedItems, processedItems + batchSize);
            
            // Procesar lote
            await this.simulateHeavyWork(200);
            
            processedItems += batch.length;
            task.progress = (processedItems / totalItems) * 100;
            
            this.notifyTaskProgress(
                task, 
                `Procesando ${operation}: ${processedItems}/${totalItems} registros`
            );
        }

        task.result = { processedItems, operation };
    }

    /**
     * Ejecuta generación de reportes en background
     */
    private async executeReportGeneration(task: BackgroundTask): Promise<void> {
        const { reportType, data } = task.data;
        const stages = [
            'Preparando datos del reporte',
            'Generando gráficos y tablas',
            'Aplicando formato profesional',
            'Optimizando para descarga',
            'Finalizando reporte'
        ];

        for (let i = 0; i < stages.length; i++) {
            task.progress = ((i + 1) / stages.length) * 100;
            
            this.notifyTaskProgress(task, stages[i]);
            
            await this.simulateHeavyWork(task.estimatedDuration / stages.length);
        }

        task.result = {
            reportType,
            fileName: `reporte_${reportType}_${Date.now()}.pdf`,
            size: '2.4 MB'
        };
    }

    /**
     * Ejecuta actualización de cache en background
     */
    private async executeCacheUpdate(task: BackgroundTask): Promise<void> {
        const { cacheKeys } = task.data;
        
        for (let i = 0; i < cacheKeys.length; i++) {
            task.progress = ((i + 1) / cacheKeys.length) * 100;
            
            this.notifyTaskProgress(
                task, 
                `Actualizando cache: ${i + 1}/${cacheKeys.length}`
            );
            
            await this.simulateHeavyWork(1000);
        }

        task.result = { updatedKeys: cacheKeys.length };
    }

    /**
     * Simula trabajo pesado con delay
     */
    private async simulateHeavyWork(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Registra callback para notificaciones
     */
    public onNotification(callback: (notification: any) => void): string {
        const id = this.generateTaskId();
        this.notificationCallbacks.set(id, callback);
        return id;
    }

    /**
     * Desregistra callback de notificaciones
     */
    public offNotification(id: string): void {
        this.notificationCallbacks.delete(id);
    }

    /**
     * Notifica que una tarea fue agregada a la cola
     */
    private notifyTaskQueued(task: BackgroundTask): void {
        this.sendNotification({
            type: 'task_queued',
            taskId: task.id,
            message: `Tarea agregada a la cola: ${this.getTaskTypeLabel(task.type)}`,
            priority: task.priority,
            timestamp: Date.now()
        });
    }

    /**
     * Notifica que una tarea comenzó
     */
    private notifyTaskStarted(task: BackgroundTask): void {
        this.sendNotification({
            type: 'task_started',
            taskId: task.id,
            message: `Iniciando: ${this.getTaskTypeLabel(task.type)}`,
            estimatedDuration: task.estimatedDuration,
            timestamp: Date.now()
        });
    }

    /**
     * Notifica progreso de una tarea
     */
    private notifyTaskProgress(task: BackgroundTask, stage: string): void {
        const progress: TaskProgress = {
            taskId: task.id,
            progress: task.progress,
            message: stage,
            stage,
            estimatedTimeRemaining: this.calculateETA(task)
        };

        this.sendNotification({
            type: 'task_progress',
            taskId: task.id,
            progress,
            timestamp: Date.now()
        });
    }

    /**
     * Notifica que una tarea se completó
     */
    private notifyTaskCompleted(task: BackgroundTask): void {
        this.sendNotification({
            type: 'task_completed',
            taskId: task.id,
            message: `Completado: ${this.getTaskTypeLabel(task.type)}`,
            duration: task.actualDuration,
            result: task.result,
            timestamp: Date.now()
        });
    }

    /**
     * Notifica que una tarea falló
     */
    private notifyTaskFailed(task: BackgroundTask): void {
        this.sendNotification({
            type: 'task_failed',
            taskId: task.id,
            message: `Error en: ${this.getTaskTypeLabel(task.type)}`,
            error: task.error,
            timestamp: Date.now()
        });
    }

    /**
     * Envía notificación a todos los callbacks registrados
     */
    private sendNotification(notification: any): void {
        for (const callback of this.notificationCallbacks.values()) {
            try {
                callback(notification);
            } catch (error) {
                console.error('Error en callback de notificación:', error);
            }
        }
    }

    /**
     * Calcula tiempo estimado restante para una tarea
     */
    private calculateETA(task: BackgroundTask): number {
        if (task.progress === 0) return task.estimatedDuration / 1000;
        
        const elapsed = Date.now() - task.startTime;
        const rate = task.progress / elapsed;
        const remaining = (100 - task.progress) / rate;
        
        return Math.round(remaining / 1000); // En segundos
    }

    /**
     * Obtiene etiqueta legible para tipo de tarea
     */
    private getTaskTypeLabel(type: BackgroundTask['type']): string {
        const labels = {
            'risk_analysis': 'Análisis de Riesgo',
            'data_processing': 'Procesamiento de Datos',
            'report_generation': 'Generación de Reporte',
            'cache_update': 'Actualización de Cache'
        };
        
        return labels[type] || type;
    }

    /**
     * Obtiene estado de una tarea
     */
    public getTaskStatus(taskId: string): BackgroundTask | null {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Obtiene todas las tareas activas
     */
    public getActiveTasks(): BackgroundTask[] {
        return Array.from(this.tasks.values())
            .filter(task => task.status === 'running' || task.status === 'queued');
    }

    /**
     * Cancela una tarea
     */
    public cancelTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status === 'completed' || task.status === 'failed') {
            return false;
        }

        task.status = 'cancelled';
        
        // Remover de la cola si está pendiente
        const queueIndex = this.taskQueue.indexOf(taskId);
        if (queueIndex > -1) {
            this.taskQueue.splice(queueIndex, 1);
        }

        console.log(`🛑 Tarea cancelada: ${taskId}`);
        return true;
    }

    /**
     * Limpia tareas completadas antiguas
     */
    public cleanupOldTasks(maxAge: number = 3600000): void { // 1 hora por defecto
        const now = Date.now();
        let cleaned = 0;

        for (const [taskId, task] of this.tasks.entries()) {
            if (
                (task.status === 'completed' || task.status === 'failed') &&
                task.endTime &&
                (now - task.endTime) > maxAge
            ) {
                this.tasks.delete(taskId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Limpiadas ${cleaned} tareas antiguas`);
        }
    }
}

// Instancia singleton del servicio
export const backgroundProcessingService = new BackgroundProcessingService();

// Hook personalizado para usar procesamiento en background
export const useBackgroundProcessing = () => {
    return {
        addTask: (
            type: BackgroundTask['type'],
            data: any,
            priority?: BackgroundTask['priority'],
            estimatedDuration?: number
        ) => backgroundProcessingService.addTask(type, data, priority, estimatedDuration),
        
        getTaskStatus: (taskId: string) => 
            backgroundProcessingService.getTaskStatus(taskId),
        
        getActiveTasks: () => 
            backgroundProcessingService.getActiveTasks(),
        
        cancelTask: (taskId: string) => 
            backgroundProcessingService.cancelTask(taskId),
        
        onNotification: (callback: (notification: any) => void) => 
            backgroundProcessingService.onNotification(callback),
        
        offNotification: (id: string) => 
            backgroundProcessingService.offNotification(id),
        
        cleanup: (maxAge?: number) => 
            backgroundProcessingService.cleanupOldTasks(maxAge)
    };
};

export type { BackgroundTask, TaskProgress, NotificationConfig };