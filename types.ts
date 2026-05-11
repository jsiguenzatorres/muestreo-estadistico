
export enum SamplingMethod {
    Attribute = 'attribute',
    MUS = 'mus',
    CAV = 'cav',
    Stratified = 'stratified',
    NonStatistical = 'non_statistical',
}

export type InsightType = 'RiskScoring' | 'Benford' | 'Outliers' | 'Duplicates' | 'RoundNumbers' | 'Entropy' | 'Splitting' | 'Sequential' | 'IsolationForest' | 'ActorProfiling' | 'EnhancedBenford' | 'Default';

export interface NonStatisticalParams {
    criteria: string;
    justification: string;
    sampleSize?: number;
    selectedInsight?: InsightType;
    sizeJustification?: string;
    materiality?: number;
    processCriticality?: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
}

export interface StratifiedParams {
    basis: 'Monetary' | 'Category' | 'Subcategory' | 'MultiVariable';
    selectedVariables: ('Category' | 'Subcategory')[];
    strataCount: number;
    allocationMethod: 'Proporcional' | 'Óptima (Neyman)' | 'Igualitaria' | 'Manual' | 'Proportional' | 'Neyman (Scientific)' | 'Neyman';
    certaintyStratumThreshold: number;
    NC: number;
    ET: number;
    PE?: number;
    usePilotSample: boolean;
    sampleSize?: number;
    manualAllocations?: Record<string, number>;
}




export enum Step {
    Connection = 'Connection',
    GeneralParams = 'GeneralParams',
    SamplingMethod = 'SamplingMethod',
    Results = 'Results',
}

export interface ObservationEvidence {
    nombre: string;
    url: string;
    tipo: string;
}

export interface AuditObservation {
    id?: string;
    id_poblacion: string;
    metodo: SamplingMethod;
    fecha_creacion?: string;
    titulo: string;
    descripcion: string;
    severidad: 'Bajo' | 'Medio' | 'Alto';
    tipo: 'Control' | 'Sustantivo' | 'Cumplimiento';
    creado_por?: string;
    evidencias?: ObservationEvidence[];
    review_comments?: {
        user: string;
        comment: string;
        date: string;
    }[];
}

export interface ColumnMapping {
    uniqueId: string;
    monetaryValue?: string;
    category?: string;
    subcategory?: string;
    date?: string;
    user?: string;
    vendor?: string;
    timestamp?: string;
    sequentialId?: string;
}

export interface DescriptiveStats {
    min: number;
    max: number;
    sum: number;
    avg: number;
    std_dev: number;
    cv: number;
    variance?: number;
    skewness?: number;
    kurtosis?: number;
    population_std_dev?: number;
    population_variance?: number;
}

export interface BenfordAnalysis {
    digit: number;
    expectedFreq: number;
    actualFreq: number;
    actualCount: number;
    isSuspicious: boolean;
}

export interface ForensicTest {
    id: string;
    name: string;
    description: string;
    requiredColumns: string[];
    icon: string;
    active: boolean;
    aiRecommendation?: string;
}

export interface DateStats {
    earliest: string;
    latest: string;
    weekendCount: number;
    holidayCount: number;
    daysGap: number;
}

export interface CharStats {
    blankCount: number;
    uniqueCount: number;
    avgLength: number;
    maxLength: number;
}

export interface RelativeSizeFactor {
    topValue: number;
    secondTopValue: number;
    rsf: number;
    topId: string | number;
}

export interface EdaMetrics {
    netValue: number;
    absoluteValue: number;
    totalRecords: number;
    zerosCount: number;
    positiveValue: number;
    negativeValue: number;
    positiveCount: number;
    negativeCount: number;
    errorDataCount: number;
    correctDataCount: number;
    meanValue: number;
    minValue: number;
    maxValue: number;
    minId?: string | number;
    maxId?: string | number;
    sampleStdDev: number;
    sampleVariance: number;
    populationStdDev: number;
    populationVariance: number;
    skewness: number;
    kurtosis: number;
    dateStats?: DateStats;
    charStats?: CharStats;
    rsf?: RelativeSizeFactor;
}

export interface AdvancedAnalysis {
    benford: BenfordAnalysis[];
    outliersCount: number;
    outliersThreshold: number;
    duplicatesCount: number;
    zerosCount: number;
    negativesCount: number;
    roundNumbersCount: number;
    forensicDiscovery?: string[]; // IDs of active tests
    eda?: EdaMetrics;
    entropy?: {
        categoryEntropy: number;
        subcategoryEntropy: number;
        conditionalEntropy: number;
        mutualInformation: number;
        informationGain: number;
        anomalousCount: number;
        highRiskCombinations: number;
    };
    splitting?: {
        suspiciousVendors: number;
        totalSuspiciousTransactions: number;
        averageRiskScore: number;
        highRiskGroups: number;
    };
    sequential?: {
        totalGaps: number;
        totalMissingDocuments: number;
        largestGap: number;
        highRiskGaps: number;
        suspiciousPatterns: number;
    };
    isolationForest?: {
        totalAnomalies: number;
        averagePathLength: number;
        anomalyThreshold: number;
        highRiskAnomalies: number;
    };
    actorProfiling?: {
        totalSuspiciousActors: number;
        averageRiskScore: number;
        highRiskActors: number;
        behaviorPatterns: number;
    };
    enhancedBenford?: {
        firstDigitDeviation: number;
        secondDigitDeviation: number;
        overallDeviation: number;
        suspiciousPatterns: number;
        highRiskPatterns: number;
        isFirstDigitSignificant: boolean;
        isSecondDigitSignificant: boolean;
        conformityLevel: 'CLOSE' | 'ACCEPTABLE' | 'MARGINAL' | 'NONCONFORMITY';
        conformityDescription: string;
        conformityRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    };
}

export interface RiskProfile {
    totalRiskScore: number;
    riskDistribution: { range: string; count: number }[];
    topRiskCategories: { name: string; score: number; alert: 'INFO' | 'WARNING' | 'CRITICAL' }[];
    gapAlerts: number;
    factorsCount?: {
        highValue: number;
        weekend: number;
        offHours: number;
        roundAmount: number;
    };
}

export interface RiskAnalysisResult {
    updatedRows: any[];
    profile: RiskProfile;
    advancedAnalysis: AdvancedAnalysis;
}

export interface AiRecommendation {
    recommendedMethod: SamplingMethod;
    confidenceScore: number;
    reasoning: string[];
    riskFactors: string[];
    directedSelectionAdvice: string;
}

export interface AuditPopulation {
    id: string;
    created_at: string;
    file_name: string;
    audit_name: string;
    area: string;
    status: AuditStatus;
    total_rows: number;
    total_monetary_value: number;
    column_mapping: ColumnMapping;
    descriptive_stats: DescriptiveStats;
    advanced_analysis?: AdvancedAnalysis;
    ai_recommendation?: AiRecommendation;
    risk_profile?: RiskProfile;
}

export interface AuditSampleItem {
    id: string;
    value: number;
    risk_flag?: string;
    risk_justification?: string;
    is_pilot_item?: boolean;
    stratum_label?: string;
    risk_score?: number;
    risk_factors?: string[];
    compliance_status?: 'OK' | 'EXCEPCION';
    is_manual_selection?: boolean;
    absolute_value?: number;
    error_description?: string;
    error_amount?: number;
    raw_row?: any;
}

export interface StratumMetadata {
    label: string;
    populationSize: number;
    populationValue: number;
    sampleSize: number;
}

export interface AuditResults {
    sampleSize: number;
    sample: AuditSampleItem[];
    totalErrorProjection: number;
    upperErrorLimit: number;
    findings: any[];
    methodologyNotes: string[];
    pilotMetrics?: PilotMetrics;
    observations?: AuditObservation[];
    sampling_params?: any;
    method?: SamplingMethod;
    strataMetadata?: StratumMetadata[];
}

export type PilotMetrics =
    | { type: 'ATTR_PILOT'; phase: 'PILOT_ONLY'; initialSize: number }
    | { type: 'MUS_PILOT'; phase: 'PILOT_ONLY'; initialSize: number; initialEE: number }
    | { type: 'CAV_PILOT'; phase: 'PILOT_ONLY'; initialSize: number; initialSigma: number; calibratedSigma: number; meanPoblacional: number; requiresRecalibration?: boolean; sigmaDeviation?: number };

export interface HistoricalSample {
    id: string;
    population_id: string;
    method: SamplingMethod;
    created_at: string;
    objective: string;
    seed: number;
    sample_size: number;
    params_snapshot: any;
    results_snapshot: AuditResults;
    is_final: boolean;
    is_current: boolean;
}

export type AuditStatus = 'PENDIENTE' | 'EN PROGRESO' | 'FINALIZADO' | 'ARCHIVADO';

export interface AppState {
    connection: any;
    selectedPopulation: AuditPopulation | null;
    generalParams: any;
    samplingMethod: SamplingMethod;
    samplingParams: {
        stratified?: StratifiedParams;
        nonStatistical?: NonStatisticalParams;
        attribute?: any;
        mus?: any;
        cav?: any;
    };
    results: AuditResults | null;
    isLocked: boolean;
    isCurrentVersion: boolean;
    historyId?: string;
    observations?: AuditObservation[];
    full_results_storage?: any; // Objeto raíz que contiene resultados de múltiples métodos
}

export interface AuditDataRow {
    [key: string]: any;
    unique_id_col?: string | number;
    monetary_value_col?: number;
    raw_json?: any; // CORREGIDO: raw_data -> raw_json para coincidir con DB
}

export type UserRole = 'Admin' | 'Auditor' | 'Supervisor' | 'Viewer';

export type AppView = 'main_dashboard' | 'population_manager' | 'data_upload' | 'validation_workspace' | 'discovery_analysis' | 'risk_profiling' | 'dashboard' | 'sampling_config' | 'results' | 'audit_expediente' | 'admin_user_management';
