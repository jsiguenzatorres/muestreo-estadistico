
import { AuditPopulation, RiskProfile, RiskAnalysisResult, AdvancedAnalysis, EdaMetrics, BenfordAnalysis, RelativeSizeFactor } from '../types';

const BENFORD_PROBABILITIES = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];

// ===== ANÁLISIS DE ENTROPÍA =====
interface EntropyAnalysis {
    categoryEntropy: number;
    subcategoryEntropy: number;
    conditionalEntropy: number;
    mutualInformation: number;
    informationGain: number;
    anomalousCategories: CategoryAnomaly[];
}

interface CategoryAnomaly {
    combination: string;
    category: string | null;
    subcategory: string | null;
    frequency: number;
    rarity: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Calcula la entropía de Shannon para un conjunto de categorías
 */
function calculateEntropy(categories: string[]): number {
    if (!categories || categories.length === 0) return 0;
    
    const counts = new Map<string, number>();
    categories.forEach(cat => {
        const key = String(cat || 'NULL');
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    
    const total = categories.length;
    let entropy = 0;
    
    for (const count of counts.values()) {
        const probability = count / total;
        if (probability > 0) {
            entropy -= probability * Math.log2(probability);
        }
    }
    
    return entropy;
}

/**
 * Calcula la entropía condicional H(Y|X)
 */
function calculateConditionalEntropy(primaryCategories: string[], secondaryCategories: string[]): number {
    if (primaryCategories.length !== secondaryCategories.length) {
        return 0;
    }
    
    const groups = new Map<string, string[]>();
    for (let i = 0; i < primaryCategories.length; i++) {
        const primary = String(primaryCategories[i] || 'NULL');
        const secondary = String(secondaryCategories[i] || 'NULL');
        
        if (!groups.has(primary)) {
            groups.set(primary, []);
        }
        groups.get(primary)!.push(secondary);
    }
    
    const total = primaryCategories.length;
    let conditionalEntropy = 0;
    
    for (const [primary, secondaries] of groups.entries()) {
        const probability = secondaries.length / total;
        const entropy = calculateEntropy(secondaries);
        conditionalEntropy += probability * entropy;
    }
    
    return conditionalEntropy;
}

/**
 * Detecta anomalías categóricas basadas en entropía
 */
function performEntropyAnalysis(rows: any[], mapping: any): EntropyAnalysis {
    const categoryField = mapping.category;
    const subcategoryField = mapping.subcategory;
    
    // Si no hay campos categóricos, retornar análisis vacío
    if (!categoryField && !subcategoryField) {
        return {
            categoryEntropy: 0,
            subcategoryEntropy: 0,
            conditionalEntropy: 0,
            mutualInformation: 0,
            informationGain: 0,
            anomalousCategories: []
        };
    }
    
    const categories = rows.map(r => {
        const raw = r.raw_json || {};
        return raw[categoryField] || null;
    });
    
    const subcategories = rows.map(r => {
        const raw = r.raw_json || {};
        return raw[subcategoryField] || null;
    });
    
    // Calcular métricas de entropía
    const categoryEntropy = calculateEntropy(categories);
    const subcategoryEntropy = calculateEntropy(subcategories);
    const conditionalEntropy = calculateConditionalEntropy(categories, subcategories);
    const mutualInformation = subcategoryEntropy - conditionalEntropy;
    const informationGain = mutualInformation;
    
    // Detectar combinaciones anómalas
    const combinationCounts = new Map<string, number>();
    const anomalies: CategoryAnomaly[] = [];
    
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const cat = raw[categoryField] || 'NULL';
        const subcat = raw[subcategoryField] || 'NULL';
        const combo = `${cat}_${subcat}`;
        combinationCounts.set(combo, (combinationCounts.get(combo) || 0) + 1);
    });
    
    // Identificar combinaciones raras (frecuencia < 2% del total o únicas)
    const threshold = Math.max(1, Math.floor(rows.length * 0.02));
    
    for (const [combo, count] of combinationCounts.entries()) {
        if (count <= threshold) {
            const [category, subcategory] = combo.split('_');
            anomalies.push({
                combination: combo,
                category: category === 'NULL' ? null : category,
                subcategory: subcategory === 'NULL' ? null : subcategory,
                frequency: count,
                rarity: count / rows.length,
                riskLevel: count === 1 ? 'HIGH' : (count <= threshold / 2 ? 'MEDIUM' : 'LOW')
            });
        }
    }
    
    return {
        categoryEntropy,
        subcategoryEntropy,
        conditionalEntropy,
        mutualInformation,
        informationGain,
        anomalousCategories: anomalies.sort((a, b) => a.frequency - b.frequency)
    };
}

// ===== DETECCIÓN DE FRACCIONAMIENTO =====
interface SplittingAnalysis {
    suspiciousGroups: SplittingGroup[];
    totalSuspiciousTransactions: number;
    averageRiskScore: number;
}

interface SplittingGroup {
    vendor: string;
    transactions: SplittingTransaction[];
    totalAmount: number;
    timeWindow: number; // días
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    suspiciousReasons: string[];
}

interface SplittingTransaction {
    id: string;
    amount: number;
    date: string;
    daysSinceFirst: number;
}

/**
 * Detecta fraccionamiento de compras para evadir umbrales
 */
function performSplittingAnalysis(rows: any[], mapping: any, customThresholds?: number[]): SplittingAnalysis {
    const monetaryField = mapping.monetaryValue;
    const vendorField = mapping.vendor;
    const dateField = mapping.date;
    
    // Si no hay campos necesarios, retornar análisis vacío
    if (!monetaryField || !vendorField || !dateField) {
        return {
            suspiciousGroups: [],
            totalSuspiciousTransactions: 0,
            averageRiskScore: 0
        };
    }
    
    // Umbrales configurables por el usuario o valores por defecto
    const thresholds = customThresholds && customThresholds.length > 0 
        ? customThresholds 
        : [1000, 5000, 10000, 25000, 50000, 100000];
    
    const maxTimeWindow = 30; // días (también podría ser configurable)
    
    // Agrupar transacciones por proveedor
    const vendorGroups = new Map<string, any[]>();
    
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const vendor = raw[vendorField];
        const amount = parseCurrency(raw[monetaryField]);
        const dateStr = raw[dateField];
        
        if (vendor && amount > 0 && dateStr) {
            if (!vendorGroups.has(vendor)) {
                vendorGroups.set(vendor, []);
            }
            
            vendorGroups.get(vendor)!.push({
                id: r.unique_id_col,
                amount: amount,
                date: new Date(dateStr),
                vendor: vendor,
                raw: r
            });
        }
    });
    
    const suspiciousGroups: SplittingGroup[] = [];
    
    // Analizar cada grupo de proveedor
    for (const [vendor, transactions] of vendorGroups.entries()) {
        if (transactions.length < 2) continue; // Necesitamos al menos 2 transacciones
        
        // Ordenar por fecha
        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Analizar ventanas de tiempo deslizantes
        for (let i = 0; i < transactions.length - 1; i++) {
            const windowTransactions = [transactions[i]];
            const startDate = transactions[i].date;
            let totalAmount = transactions[i].amount;
            
            // Agregar transacciones dentro de la ventana de tiempo
            for (let j = i + 1; j < transactions.length; j++) {
                const daysDiff = Math.floor((transactions[j].date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= maxTimeWindow) {
                    windowTransactions.push(transactions[j]);
                    totalAmount += transactions[j].amount;
                } else {
                    break; // Fuera de la ventana de tiempo
                }
            }
            
            // Verificar si hay fraccionamiento sospechoso
            if (windowTransactions.length >= 2) {
                const splittingGroup = analyzeSplittingPattern(windowTransactions, totalAmount, thresholds, startDate);
                if (splittingGroup && splittingGroup.riskScore > 0) {
                    suspiciousGroups.push(splittingGroup);
                }
            }
        }
    }
    
    // Eliminar duplicados y mantener solo los grupos más sospechosos por proveedor
    const uniqueGroups = new Map<string, SplittingGroup>();
    suspiciousGroups.forEach(group => {
        const existing = uniqueGroups.get(group.vendor);
        if (!existing || group.riskScore > existing.riskScore) {
            uniqueGroups.set(group.vendor, group);
        }
    });
    
    const finalGroups = Array.from(uniqueGroups.values()).sort((a, b) => b.riskScore - a.riskScore);
    const totalSuspicious = finalGroups.reduce((sum, g) => sum + g.transactions.length, 0);
    const avgRisk = finalGroups.length > 0 ? finalGroups.reduce((sum, g) => sum + g.riskScore, 0) / finalGroups.length : 0;
    
    return {
        suspiciousGroups: finalGroups,
        totalSuspiciousTransactions: totalSuspicious,
        averageRiskScore: avgRisk
    };
}

/**
 * Analiza un patrón específico de transacciones para detectar fraccionamiento
 */
function analyzeSplittingPattern(transactions: any[], totalAmount: number, thresholds: number[], startDate: Date): SplittingGroup | null {
    const vendor = transactions[0].vendor;
    let riskScore = 0;
    const suspiciousReasons: string[] = [];
    
    // Verificar si la suma total excede umbrales pero transacciones individuales no
    for (const threshold of thresholds) {
        if (totalAmount > threshold) {
            const allBelowThreshold = transactions.every(t => t.amount < threshold * 0.9); // 90% del umbral
            
            if (allBelowThreshold) {
                riskScore += 30; // Alto riesgo por fraccionamiento
                suspiciousReasons.push(`Total ${totalAmount.toLocaleString()} excede umbral ${threshold.toLocaleString()} pero transacciones individuales están debajo`);
                break; // Solo contar el primer umbral que coincida
            }
        }
    }
    
    // Verificar patrones adicionales sospechosos
    
    // 1. Montos muy similares (variación < 10%)
    const amounts = transactions.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const maxVariation = Math.max(...amounts.map(a => Math.abs(a - avgAmount) / avgAmount));
    
    if (maxVariation < 0.1 && transactions.length >= 3) {
        riskScore += 15;
        suspiciousReasons.push('Montos muy similares sugieren fraccionamiento intencional');
    }
    
    // 2. Frecuencia alta en poco tiempo
    const endDate = transactions[transactions.length - 1].date;
    const timeWindow = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (transactions.length >= 3 && timeWindow <= 7) {
        riskScore += 20;
        suspiciousReasons.push(`${transactions.length} transacciones en ${timeWindow} días es inusualmente frecuente`);
    }
    
    // 3. Montos justo debajo de umbrales redondos
    const roundThresholds = [1000, 5000, 10000, 25000, 50000];
    for (const threshold of roundThresholds) {
        const nearThreshold = transactions.filter(t => 
            t.amount >= threshold * 0.8 && t.amount < threshold
        );
        
        if (nearThreshold.length >= 2) {
            riskScore += 10;
            suspiciousReasons.push(`Múltiples transacciones cerca del umbral ${threshold.toLocaleString()}`);
        }
    }
    
    if (riskScore === 0) return null;
    
    // Determinar nivel de riesgo
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 40) riskLevel = 'HIGH';
    else if (riskScore >= 20) riskLevel = 'MEDIUM';
    
    return {
        vendor,
        transactions: transactions.map(t => ({
            id: t.id,
            amount: t.amount,
            date: t.date.toISOString().split('T')[0],
            daysSinceFirst: Math.floor((t.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        })),
        totalAmount,
        timeWindow,
        riskScore,
        riskLevel,
        suspiciousReasons
    };
}

// ===== INTEGRIDAD SECUENCIAL (GAPS) =====
interface SequentialAnalysis {
    gaps: SequentialGap[];
    totalGaps: number;
    totalMissingDocuments: number;
    largestGap: number;
    suspiciousPatterns: string[];
}

interface SequentialGap {
    start: number;
    end: number;
    size: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    missingIds: string[];
}

// ===== ISOLATION FOREST =====
interface IsolationForestAnalysis {
    anomalies: IsolationAnomaly[];
    averagePathLength: number;
    anomalyThreshold: number;
    totalAnomalies: number;
}

interface IsolationAnomaly {
    id: string;
    pathLength: number;
    anomalyScore: number;
    isAnomaly: boolean;
    features: number[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ===== ACTOR PROFILING =====
interface ActorProfilingAnalysis {
    suspiciousActors: SuspiciousActor[];
    totalSuspiciousActors: number;
    averageRiskScore: number;
    behaviorPatterns: BehaviorPattern[];
}

interface SuspiciousActor {
    actorId: string;
    actorName: string;
    transactionCount: number;
    totalAmount: number;
    averageAmount: number;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    suspiciousPatterns: string[];
    timePatterns: {
        weekendTransactions: number;
        offHoursTransactions: number;
        consecutiveDays: number;
    };
    amountPatterns: {
        roundAmounts: number;
        highValueTransactions: number;
        duplicateAmounts: number;
    };
}

interface BehaviorPattern {
    pattern: string;
    description: string;
    affectedActors: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ===== ENHANCED BENFORD ANALYSIS =====
interface EnhancedBenfordAnalysis {
    firstDigitAnalysis: BenfordDigitAnalysis;
    secondDigitAnalysis: BenfordDigitAnalysis;
    combinedAnalysis: BenfordDigitAnalysis;
    overallDeviation: number;
    conformityLevel: 'CLOSE' | 'ACCEPTABLE' | 'MARGINAL' | 'NONCONFORMITY';
    conformityDescription: string;
    conformityRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    suspiciousDigitPatterns: SuspiciousDigitPattern[];
}

interface BenfordDigitAnalysis {
    digits: BenfordDigitResult[];
    meanAbsoluteDeviation: number;
    chiSquareStatistic: number;
    pValue: number;
    isSignificant: boolean;
}

interface BenfordDigitResult {
    digit: number;
    expected: number;
    observed: number;
    count: number;
    deviation: number;
    zScore: number;
    isSuspicious: boolean;
}

interface SuspiciousDigitPattern {
    digitCombination: string;
    type: 'FIRST_DIGIT' | 'SECOND_DIGIT' | 'COMBINED';
    deviation: number;
    frequency: number;
    expectedFrequency: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface IsolationTree {
    isLeaf: boolean;
    size: number;
    splitFeature?: number;
    splitValue?: number;
    left?: IsolationTree;
    right?: IsolationTree;
}

/**
 * Implementación simplificada de Isolation Forest
 */
class SimpleIsolationForest {
    private trees: IsolationTree[] = [];
    private numTrees: number;
    private maxDepth: number;
    private subsampleSize: number;

    constructor(numTrees: number = 100, maxDepth: number = 10, subsampleSize: number = 256) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.subsampleSize = subsampleSize;
    }

    /**
     * Entrena el bosque con los datos
     */
    fit(data: number[][]): void {
        this.trees = [];
        
        for (let i = 0; i < this.numTrees; i++) {
            // Submuestreo aleatorio
            const subsample = this.randomSubsample(data, this.subsampleSize);
            
            // Construir árbol de aislamiento
            const tree = this.buildTree(subsample, 0, this.maxDepth);
            this.trees.push(tree);
        }
    }

    /**
     * Predice anomalías para los datos
     */
    predict(data: number[][]): number[] {
        return data.map(point => {
            const pathLengths = this.trees.map(tree => this.getPathLength(point, tree, 0));
            const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
            
            // Calcular score de anomalía (menor path length = más anómalo)
            const c = this.averagePathLengthBST(this.subsampleSize);
            const anomalyScore = Math.pow(2, -avgPathLength / c);
            
            return anomalyScore;
        });
    }

    private randomSubsample(data: number[][], size: number): number[][] {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(size, data.length));
    }

    private buildTree(data: number[][], depth: number, maxDepth: number): IsolationTree {
        // Condiciones de parada
        if (depth >= maxDepth || data.length <= 1) {
            return {
                isLeaf: true,
                size: data.length
            };
        }

        // Seleccionar feature aleatorio
        const numFeatures = data[0].length;
        const splitFeature = Math.floor(Math.random() * numFeatures);
        
        // Obtener valores del feature seleccionado
        const featureValues = data.map(row => row[splitFeature]);
        const minVal = Math.min(...featureValues);
        const maxVal = Math.max(...featureValues);
        
        // Si todos los valores son iguales, crear hoja
        if (minVal === maxVal) {
            return {
                isLeaf: true,
                size: data.length
            };
        }

        // Seleccionar punto de división aleatorio
        const splitValue = Math.random() * (maxVal - minVal) + minVal;

        // Dividir datos
        const leftData = data.filter(row => row[splitFeature] < splitValue);
        const rightData = data.filter(row => row[splitFeature] >= splitValue);

        // Si una división está vacía, crear hoja
        if (leftData.length === 0 || rightData.length === 0) {
            return {
                isLeaf: true,
                size: data.length
            };
        }

        // Construir subárboles recursivamente
        return {
            isLeaf: false,
            size: data.length,
            splitFeature,
            splitValue,
            left: this.buildTree(leftData, depth + 1, maxDepth),
            right: this.buildTree(rightData, depth + 1, maxDepth)
        };
    }

    private getPathLength(point: number[], tree: IsolationTree, currentDepth: number): number {
        if (tree.isLeaf) {
            // Ajustar por el tamaño del nodo hoja
            return currentDepth + this.averagePathLengthBST(tree.size);
        }

        if (point[tree.splitFeature!] < tree.splitValue!) {
            return this.getPathLength(point, tree.left!, currentDepth + 1);
        } else {
            return this.getPathLength(point, tree.right!, currentDepth + 1);
        }
    }

    private averagePathLengthBST(n: number): number {
        if (n <= 1) return 0;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
    }
}

/**
 * Realiza análisis de Isolation Forest en los datos
 */
function performIsolationForestAnalysis(rows: any[], mapping: any): IsolationForestAnalysis {
    const monetaryField = mapping.monetaryValue;
    const dateField = mapping.date;
    const categoryField = mapping.category;
    
    // Si no hay suficientes campos, retornar análisis vacío
    if (!monetaryField) {
        return {
            anomalies: [],
            averagePathLength: 0,
            anomalyThreshold: 0.5,
            totalAnomalies: 0
        };
    }

    // Preparar features para el análisis
    const features: number[][] = [];
    const rowIds: string[] = [];

    rows.forEach(r => {
        const raw = r.raw_json || {};
        const monetaryValue = parseCurrency(raw[monetaryField]);
        
        if (monetaryValue > 0) {
            const featureVector: number[] = [];
            
            // Feature 1: Valor monetario (log-transformado para normalizar)
            featureVector.push(Math.log10(monetaryValue + 1));
            
            // Feature 2: Día de la semana (si hay fecha)
            if (dateField && raw[dateField]) {
                const date = new Date(raw[dateField]);
                if (!isNaN(date.getTime())) {
                    featureVector.push(date.getDay()); // 0-6
                } else {
                    featureVector.push(3); // Valor neutral
                }
            } else {
                featureVector.push(3); // Valor neutral
            }
            
            // Feature 3: Hora del día (si hay timestamp)
            if (dateField && raw[dateField]) {
                const date = new Date(raw[dateField]);
                if (!isNaN(date.getTime())) {
                    featureVector.push(date.getHours()); // 0-23
                } else {
                    featureVector.push(12); // Valor neutral
                }
            } else {
                featureVector.push(12); // Valor neutral
            }
            
            // Feature 4: Longitud del ID único (proxy para complejidad)
            const uniqueId = r.unique_id_col || '';
            featureVector.push(String(uniqueId).length);
            
            // Feature 5: Categoría hash (si existe)
            if (categoryField && raw[categoryField]) {
                const categoryHash = String(raw[categoryField]).length % 10;
                featureVector.push(categoryHash);
            } else {
                featureVector.push(5); // Valor neutral
            }

            features.push(featureVector);
            rowIds.push(r.unique_id_col || `row-${features.length}`);
        }
    });

    // Si no hay suficientes datos, retornar vacío
    if (features.length < 10) {
        return {
            anomalies: [],
            averagePathLength: 0,
            anomalyThreshold: 0.5,
            totalAnomalies: 0
        };
    }

    // Entrenar Isolation Forest
    const forest = new SimpleIsolationForest(50, 8, Math.min(256, features.length));
    forest.fit(features);
    
    // Predecir anomalías
    const anomalyScores = forest.predict(features);
    
    // Calcular umbral (percentil 95)
    const sortedScores = [...anomalyScores].sort((a, b) => b - a);
    const anomalyThreshold = sortedScores[Math.floor(sortedScores.length * 0.05)] || 0.6;
    
    // Crear lista de anomalías
    const anomalies: IsolationAnomaly[] = [];
    
    anomalyScores.forEach((score, index) => {
        const isAnomaly = score > anomalyThreshold;
        
        if (isAnomaly) {
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (score > 0.8) riskLevel = 'HIGH';
            else if (score > 0.7) riskLevel = 'MEDIUM';
            
            anomalies.push({
                id: rowIds[index],
                pathLength: 0, // Simplificado
                anomalyScore: score,
                isAnomaly: true,
                features: features[index],
                riskLevel
            });
        }
    });

    const averagePathLength = anomalyScores.reduce((sum, score) => sum + score, 0) / anomalyScores.length;

    return {
        anomalies: anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore),
        averagePathLength,
        anomalyThreshold,
        totalAnomalies: anomalies.length
    };
}

/**
 * Realiza análisis de perfilado de actores para detectar comportamientos sospechosos
 */
function performActorProfilingAnalysis(rows: any[], mapping: any): ActorProfilingAnalysis {
    const userField = mapping.user;
    const monetaryField = mapping.monetaryValue;
    const dateField = mapping.date;
    const vendorField = mapping.vendor;
    
    // Si no hay campo de usuario, retornar análisis vacío
    if (!userField) {
        return {
            suspiciousActors: [],
            totalSuspiciousActors: 0,
            averageRiskScore: 0,
            behaviorPatterns: []
        };
    }
    
    // Agrupar transacciones por actor
    const actorGroups = new Map<string, any[]>();
    
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const actor = raw[userField];
        
        if (actor) {
            if (!actorGroups.has(actor)) {
                actorGroups.set(actor, []);
            }
            actorGroups.get(actor)!.push({
                ...r,
                amount: parseCurrency(raw[monetaryField]),
                date: raw[dateField] ? new Date(raw[dateField]) : null,
                vendor: raw[vendorField] || null
            });
        }
    });
    
    const suspiciousActors: SuspiciousActor[] = [];
    const behaviorPatterns: BehaviorPattern[] = [];
    
    // Analizar cada actor
    for (const [actorId, transactions] of actorGroups.entries()) {
        if (transactions.length < 2) continue; // Necesitamos al menos 2 transacciones
        
        const analysis = analyzeActorBehavior(actorId, transactions);
        if (analysis && analysis.riskScore > 0) {
            suspiciousActors.push(analysis);
        }
    }
    
    // Detectar patrones de comportamiento globales
    behaviorPatterns.push(...detectBehaviorPatterns(actorGroups));
    
    const totalSuspicious = suspiciousActors.length;
    const avgRisk = totalSuspicious > 0 ? 
        suspiciousActors.reduce((sum, a) => sum + a.riskScore, 0) / totalSuspicious : 0;
    
    return {
        suspiciousActors: suspiciousActors.sort((a, b) => b.riskScore - a.riskScore),
        totalSuspiciousActors: totalSuspicious,
        averageRiskScore: avgRisk,
        behaviorPatterns: behaviorPatterns.sort((a, b) => b.affectedActors - a.affectedActors)
    };
}

/**
 * Analiza el comportamiento de un actor específico
 */
function analyzeActorBehavior(actorId: string, transactions: any[]): SuspiciousActor | null {
    const amounts = transactions.map(t => t.amount).filter(a => a > 0);
    if (amounts.length === 0) return null;
    
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const averageAmount = totalAmount / amounts.length;
    
    let riskScore = 0;
    const suspiciousPatterns: string[] = [];
    
    // Análisis de patrones temporales
    let weekendTransactions = 0;
    let offHoursTransactions = 0;
    let consecutiveDays = 0;
    
    const dates = transactions
        .map(t => t.date)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
    
    dates.forEach(date => {
        const day = date.getDay();
        const hour = date.getHours();
        
        if (day === 0 || day === 6) {
            weekendTransactions++;
        }
        
        if (hour < 6 || hour > 20) {
            offHoursTransactions++;
        }
    });
    
    // Detectar días consecutivos
    if (dates.length > 1) {
        let currentStreak = 1;
        let maxStreak = 1;
        
        for (let i = 1; i < dates.length; i++) {
            const daysDiff = Math.floor((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        consecutiveDays = maxStreak;
    }
    
    // Análisis de patrones de montos
    let roundAmounts = 0;
    let highValueTransactions = 0;
    let duplicateAmounts = 0;
    
    const amountCounts = new Map<number, number>();
    amounts.forEach(amount => {
        // Montos redondos
        if (amount >= 100 && amount % 100 === 0) {
            roundAmounts++;
        }
        
        // Transacciones de alto valor (top 10%)
        const threshold = amounts.sort((a, b) => b - a)[Math.floor(amounts.length * 0.1)] || 0;
        if (amount >= threshold && threshold > 0) {
            highValueTransactions++;
        }
        
        // Duplicados exactos
        amountCounts.set(amount, (amountCounts.get(amount) || 0) + 1);
    });
    
    duplicateAmounts = Array.from(amountCounts.values()).filter(count => count > 1).length;
    
    // Calcular score de riesgo
    
    // 1. Actividad en fines de semana (sospechoso si >30% de transacciones)
    if (weekendTransactions / transactions.length > 0.3) {
        riskScore += 15;
        suspiciousPatterns.push('Actividad alta en fines de semana');
    }
    
    // 2. Actividad fuera de horario (sospechoso si >40% de transacciones)
    if (offHoursTransactions / transactions.length > 0.4) {
        riskScore += 20;
        suspiciousPatterns.push('Actividad fuera de horario laboral');
    }
    
    // 3. Transacciones en días consecutivos (sospechoso si >5 días seguidos)
    if (consecutiveDays > 5) {
        riskScore += 10;
        suspiciousPatterns.push(`Transacciones en ${consecutiveDays} días consecutivos`);
    }
    
    // 4. Alto porcentaje de montos redondos (sospechoso si >50%)
    if (roundAmounts / amounts.length > 0.5) {
        riskScore += 15;
        suspiciousPatterns.push('Alto porcentaje de montos redondos');
    }
    
    // 5. Muchas transacciones de alto valor (sospechoso si >20% son top 10%)
    if (highValueTransactions / amounts.length > 0.2) {
        riskScore += 20;
        suspiciousPatterns.push('Concentración en transacciones de alto valor');
    }
    
    // 6. Montos duplicados frecuentes (sospechoso si >30% son duplicados)
    if (duplicateAmounts / amounts.length > 0.3) {
        riskScore += 25;
        suspiciousPatterns.push('Patrones repetitivos en montos');
    }
    
    // 7. Volumen inusual de transacciones (sospechoso si >percentil 95)
    // Este se calculará a nivel global después
    
    if (riskScore === 0) return null;
    
    // Determinar nivel de riesgo
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';
    
    return {
        actorId,
        actorName: actorId, // En un sistema real, esto sería el nombre completo
        transactionCount: transactions.length,
        totalAmount,
        averageAmount,
        riskScore,
        riskLevel,
        suspiciousPatterns,
        timePatterns: {
            weekendTransactions,
            offHoursTransactions,
            consecutiveDays
        },
        amountPatterns: {
            roundAmounts,
            highValueTransactions,
            duplicateAmounts
        }
    };
}

/**
 * Detecta patrones de comportamiento a nivel global
 */
function detectBehaviorPatterns(actorGroups: Map<string, any[]>): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    
    // Calcular estadísticas globales
    const allTransactionCounts = Array.from(actorGroups.values()).map(txs => txs.length);
    const avgTransactionsPerActor = allTransactionCounts.reduce((sum, count) => sum + count, 0) / allTransactionCounts.length;
    const transactionThreshold = avgTransactionsPerActor * 3; // 3x el promedio
    
    // Patrón 1: Actores con volumen inusualmente alto
    const highVolumeActors = Array.from(actorGroups.entries())
        .filter(([_, txs]) => txs.length > transactionThreshold).length;
    
    if (highVolumeActors > 0) {
        patterns.push({
            pattern: 'HIGH_VOLUME_ACTORS',
            description: `${highVolumeActors} actores con volumen de transacciones inusualmente alto`,
            affectedActors: highVolumeActors,
            riskLevel: highVolumeActors > 5 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    // Patrón 2: Concentración de actividad en pocos actores
    const totalTransactions = allTransactionCounts.reduce((sum, count) => sum + count, 0);
    const sortedCounts = allTransactionCounts.sort((a, b) => b - a);
    const top10Percent = Math.max(1, Math.floor(sortedCounts.length * 0.1));
    const top10PercentTransactions = sortedCounts.slice(0, top10Percent).reduce((sum, count) => sum + count, 0);
    const concentrationRatio = top10PercentTransactions / totalTransactions;
    
    if (concentrationRatio > 0.5) {
        patterns.push({
            pattern: 'ACTIVITY_CONCENTRATION',
            description: `${(concentrationRatio * 100).toFixed(1)}% de las transacciones concentradas en el 10% de actores más activos`,
            affectedActors: top10Percent,
            riskLevel: concentrationRatio > 0.7 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    // Patrón 3: Actores con patrones temporales similares
    const weekendActors = Array.from(actorGroups.entries())
        .filter(([_, txs]) => {
            const weekendTxs = txs.filter(t => {
                if (!t.date || isNaN(t.date.getTime())) return false;
                const day = t.date.getDay();
                return day === 0 || day === 6;
            }).length;
            return weekendTxs / txs.length > 0.3;
        }).length;
    
    if (weekendActors > 3) {
        patterns.push({
            pattern: 'WEEKEND_ACTIVITY_CLUSTER',
            description: `${weekendActors} actores con alta actividad en fines de semana`,
            affectedActors: weekendActors,
            riskLevel: weekendActors > 10 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    return patterns;
}
/**
 * Realiza análisis mejorado de la Ley de Benford incluyendo segundo dígito
 */
function performEnhancedBenfordAnalysis(rows: any[], mapping: any): EnhancedBenfordAnalysis {
    const monetaryField = mapping.monetaryValue;
    
    if (!monetaryField) {
        return createEmptyEnhancedBenfordAnalysis();
    }
    
    // Extraer valores monetarios válidos
    const monetaryValues: number[] = [];
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const value = parseCurrency(raw[monetaryField]);
        if (value > 0) {
            monetaryValues.push(value);
        }
    });
    
    if (monetaryValues.length < 30) {
        return createEmptyEnhancedBenfordAnalysis();
    }
    
    // Análisis del primer dígito
    const firstDigitAnalysis = analyzeBenfordDigits(monetaryValues, 'FIRST');
    
    // Análisis del segundo dígito
    const secondDigitAnalysis = analyzeBenfordDigits(monetaryValues, 'SECOND');
    
    // Análisis combinado (primeros dos dígitos)
    const combinedAnalysis = analyzeBenfordDigits(monetaryValues, 'COMBINED');
    
    // Calcular desviación general
    const overallDeviation = (
        firstDigitAnalysis.meanAbsoluteDeviation + 
        secondDigitAnalysis.meanAbsoluteDeviation
    ) / 2;
    
    // Interpretar conformidad según estándares forenses
    const conformityInterpretation = interpretBenfordConformity(overallDeviation / 100);
    
    // Detectar patrones sospechosos
    const suspiciousPatterns = detectSuspiciousDigitPatterns(
        firstDigitAnalysis, 
        secondDigitAnalysis, 
        combinedAnalysis
    );
    
    return {
        firstDigitAnalysis,
        secondDigitAnalysis,
        combinedAnalysis,
        overallDeviation,
        conformityLevel: conformityInterpretation.level,
        conformityDescription: conformityInterpretation.description,
        conformityRiskLevel: conformityInterpretation.riskLevel,
        suspiciousDigitPatterns: suspiciousPatterns
    };
}

/**
 * Crea un análisis de Benford vacío
 */
function createEmptyBenfordAnalysis(): BenfordDigitAnalysis {
    return {
        digits: [],
        meanAbsoluteDeviation: 0,
        chiSquareStatistic: 0,
        pValue: 1,
        isSignificant: false
    };
}

/**
 * Crea un análisis Enhanced Benford vacío
 */
function createEmptyEnhancedBenfordAnalysis(): EnhancedBenfordAnalysis {
    return {
        firstDigitAnalysis: createEmptyBenfordAnalysis(),
        secondDigitAnalysis: createEmptyBenfordAnalysis(),
        combinedAnalysis: createEmptyBenfordAnalysis(),
        overallDeviation: 0,
        conformityLevel: 'CLOSE',
        conformityDescription: 'Sin datos suficientes para análisis',
        conformityRiskLevel: 'LOW',
        suspiciousDigitPatterns: []
    };
}

/**
 * Analiza dígitos según la Ley de Benford
 */
function analyzeBenfordDigits(values: number[], type: 'FIRST' | 'SECOND' | 'COMBINED'): BenfordDigitAnalysis {
    const digitCounts = new Map<number, number>();
    const totalValues = values.length;
    
    // Contar dígitos según el tipo de análisis
    values.forEach(value => {
        const valueStr = Math.abs(value).toString();
        
        if (type === 'FIRST' && valueStr.length >= 1) {
            const digit = parseInt(valueStr.charAt(0));
            if (digit >= 1 && digit <= 9) {
                digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
            }
        } else if (type === 'SECOND' && valueStr.length >= 2) {
            const digit = parseInt(valueStr.charAt(1));
            if (digit >= 0 && digit <= 9) {
                digitCounts.set(digit, (digitCounts.get(digit) || 0) + 1);
            }
        } else if (type === 'COMBINED' && valueStr.length >= 2) {
            const combinedDigit = parseInt(valueStr.substring(0, 2));
            if (combinedDigit >= 10 && combinedDigit <= 99) {
                digitCounts.set(combinedDigit, (digitCounts.get(combinedDigit) || 0) + 1);
            }
        }
    });
    
    // Obtener probabilidades esperadas según Benford
    const expectedProbs = getBenfordProbabilities(type);
    const digits: BenfordDigitResult[] = [];
    let chiSquareSum = 0;
    let totalDeviation = 0;
    
    // Calcular estadísticas para cada dígito
    const digitRange = type === 'FIRST' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] :
                      type === 'SECOND' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] :
                      Array.from({length: 90}, (_, i) => i + 10); // 10-99 para combinado
    
    digitRange.forEach(digit => {
        const observed = (digitCounts.get(digit) || 0) / totalValues;
        const expected = expectedProbs[type === 'COMBINED' ? digit - 10 : (type === 'FIRST' ? digit - 1 : digit)] || 0;
        const count = digitCounts.get(digit) || 0;
        const deviation = Math.abs(observed - expected);
        
        // Calcular Z-score
        const expectedCount = expected * totalValues;
        const variance = expectedCount * (1 - expected);
        const zScore = variance > 0 ? (count - expectedCount) / Math.sqrt(variance) : 0;
        
        // Chi-cuadrado
        if (expectedCount > 0) {
            chiSquareSum += Math.pow(count - expectedCount, 2) / expectedCount;
        }
        
        totalDeviation += deviation;
        
        digits.push({
            digit,
            expected: expected * 100, // Convertir a porcentaje
            observed: observed * 100,
            count,
            deviation: deviation * 100,
            zScore,
            isSuspicious: Math.abs(zScore) > 1.96 || deviation > 0.015 // 1.5% MAD o Z > 1.96 (95% confianza)
        });
    });
    
    const meanAbsoluteDeviation = (totalDeviation / digitRange.length) * 100;
    
    // Calcular p-value aproximado (simplificado)
    const degreesOfFreedom = digitRange.length - 1;
    const pValue = chiSquareSum > 0 ? Math.exp(-chiSquareSum / 2) : 1; // Aproximación simple
    
    return {
        digits: digits.sort((a, b) => b.deviation - a.deviation),
        meanAbsoluteDeviation,
        chiSquareStatistic: chiSquareSum,
        pValue,
        isSignificant: pValue < 0.05
    };
}

/**
 * Obtiene las probabilidades esperadas según la Ley de Benford
 */
function getBenfordProbabilities(type: 'FIRST' | 'SECOND' | 'COMBINED'): number[] {
    if (type === 'FIRST') {
        // Probabilidades para primer dígito (1-9)
        return [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
    } else if (type === 'SECOND') {
        // Probabilidades para segundo dígito (0-9) - distribución más uniforme
        return [0.120, 0.114, 0.109, 0.104, 0.100, 0.097, 0.093, 0.090, 0.088, 0.085];
    } else {
        // Probabilidades para combinación de dos dígitos (10-99)
        const combined: number[] = [];
        for (let first = 1; first <= 9; first++) {
            for (let second = 0; second <= 9; second++) {
                const firstProb = Math.log10(1 + 1/first);
                const secondProb = Math.log10(1 + 1/(10*first + second)) - Math.log10(1 + 1/(10*first));
                combined.push(firstProb * secondProb);
            }
        }
        return combined;
    }
}

/**
 * Interpreta el nivel de conformidad con Benford según estándares forenses
 */
function interpretBenfordConformity(mad: number): {
    level: 'CLOSE' | 'ACCEPTABLE' | 'MARGINAL' | 'NONCONFORMITY';
    description: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
} {
    if (mad < 0.006) {
        return {
            level: 'CLOSE',
            description: 'Conformidad cercana - Muy probable que siga Benford',
            riskLevel: 'LOW'
        };
    } else if (mad < 0.012) {
        return {
            level: 'ACCEPTABLE', 
            description: 'Conformidad aceptable - Probable que siga Benford',
            riskLevel: 'LOW'
        };
    } else if (mad < 0.015) {
        return {
            level: 'MARGINAL',
            description: 'Conformidad marginal - Posibles anomalías menores',
            riskLevel: 'MEDIUM'
        };
    } else {
        return {
            level: 'NONCONFORMITY',
            description: 'No conformidad - Anomalías significativas detectadas',
            riskLevel: 'HIGH'
        };
    }
}

/**
 * Detecta patrones sospechosos en los análisis de dígitos
 */
function detectSuspiciousDigitPatterns(
    firstDigit: BenfordDigitAnalysis,
    secondDigit: BenfordDigitAnalysis,
    combined: BenfordDigitAnalysis
): SuspiciousDigitPattern[] {
    const patterns: SuspiciousDigitPattern[] = [];
    
    // Patrones en primer dígito
    firstDigit.digits.forEach(digit => {
        if (digit.isSuspicious) {
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (digit.deviation > 10) riskLevel = 'HIGH';
            else if (digit.deviation > 5) riskLevel = 'MEDIUM';
            
            patterns.push({
                digitCombination: `Primer dígito ${digit.digit}`,
                type: 'FIRST_DIGIT',
                deviation: digit.deviation,
                frequency: digit.observed,
                expectedFrequency: digit.expected,
                riskLevel
            });
        }
    });
    
    // Patrones en segundo dígito
    secondDigit.digits.forEach(digit => {
        if (digit.isSuspicious) {
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (digit.deviation > 8) riskLevel = 'HIGH';
            else if (digit.deviation > 4) riskLevel = 'MEDIUM';
            
            patterns.push({
                digitCombination: `Segundo dígito ${digit.digit}`,
                type: 'SECOND_DIGIT',
                deviation: digit.deviation,
                frequency: digit.observed,
                expectedFrequency: digit.expected,
                riskLevel
            });
        }
    });
    
    // Patrones específicos adicionales
    
    // 1. Exceso de números que terminan en 0 o 5 (redondeo)
    const roundingDigits = secondDigit.digits.filter(d => d.digit === 0 || d.digit === 5);
    const roundingExcess = roundingDigits.reduce((sum, d) => sum + Math.max(0, d.observed - d.expected), 0);
    
    if (roundingExcess > 10) {
        patterns.push({
            digitCombination: 'Terminaciones en 0 y 5',
            type: 'SECOND_DIGIT',
            deviation: roundingExcess,
            frequency: roundingDigits.reduce((sum, d) => sum + d.observed, 0),
            expectedFrequency: roundingDigits.reduce((sum, d) => sum + d.expected, 0),
            riskLevel: roundingExcess > 20 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    // 2. Déficit en dígitos bajos del primer dígito (posible manipulación)
    const lowFirstDigits = firstDigit.digits.filter(d => d.digit <= 3);
    const lowDigitDeficit = lowFirstDigits.reduce((sum, d) => sum + Math.max(0, d.expected - d.observed), 0);
    
    if (lowDigitDeficit > 15) {
        patterns.push({
            digitCombination: 'Primeros dígitos 1-3',
            type: 'FIRST_DIGIT',
            deviation: lowDigitDeficit,
            frequency: lowFirstDigits.reduce((sum, d) => sum + d.observed, 0),
            expectedFrequency: lowFirstDigits.reduce((sum, d) => sum + d.expected, 0),
            riskLevel: lowDigitDeficit > 25 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    // 3. Exceso en dígitos altos del primer dígito
    const highFirstDigits = firstDigit.digits.filter(d => d.digit >= 7);
    const highDigitExcess = highFirstDigits.reduce((sum, d) => sum + Math.max(0, d.observed - d.expected), 0);
    
    if (highDigitExcess > 10) {
        patterns.push({
            digitCombination: 'Primeros dígitos 7-9',
            type: 'FIRST_DIGIT',
            deviation: highDigitExcess,
            frequency: highFirstDigits.reduce((sum, d) => sum + d.observed, 0),
            expectedFrequency: highFirstDigits.reduce((sum, d) => sum + d.expected, 0),
            riskLevel: highDigitExcess > 20 ? 'HIGH' : 'MEDIUM'
        });
    }
    
    return patterns.sort((a, b) => b.deviation - a.deviation);
}

function performSequentialAnalysis(rows: any[], mapping: any): SequentialAnalysis {
    const sequentialField = mapping.sequentialId;
    
    // Si no hay campo secuencial, retornar análisis vacío
    if (!sequentialField) {
        return {
            gaps: [],
            totalGaps: 0,
            totalMissingDocuments: 0,
            largestGap: 0,
            suspiciousPatterns: []
        };
    }
    
    // Extraer y limpiar IDs secuenciales
    const sequentialIds: number[] = [];
    const idMap = new Map<number, string>(); // Para rastrear IDs originales
    
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const seqId = raw[sequentialField];
        
        if (seqId) {
            // Extraer números de diferentes formatos (ej: "FAC-001234", "INV001", "123456")
            const numericPart = String(seqId).replace(/\D/g, '');
            if (numericPart) {
                const num = parseInt(numericPart);
                if (!isNaN(num) && num > 0) {
                    sequentialIds.push(num);
                    idMap.set(num, String(seqId));
                }
            }
        }
    });
    
    if (sequentialIds.length < 2) {
        return {
            gaps: [],
            totalGaps: 0,
            totalMissingDocuments: 0,
            largestGap: 0,
            suspiciousPatterns: []
        };
    }
    
    // Ordenar y eliminar duplicados
    const uniqueIds = [...new Set(sequentialIds)].sort((a, b) => a - b);
    
    // Detectar gaps
    const gaps: SequentialGap[] = [];
    let totalMissingDocuments = 0;
    let largestGap = 0;
    
    for (let i = 1; i < uniqueIds.length; i++) {
        const current = uniqueIds[i];
        const previous = uniqueIds[i - 1];
        const expectedNext = previous + 1;
        
        if (current > expectedNext) {
            const gapSize = current - expectedNext;
            const missingIds: string[] = [];
            
            // Generar lista de IDs faltantes
            for (let missing = expectedNext; missing < current; missing++) {
                missingIds.push(missing.toString());
            }
            
            // Determinar nivel de riesgo basado en el tamaño del gap
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            if (gapSize >= 50) riskLevel = 'HIGH';
            else if (gapSize >= 10) riskLevel = 'MEDIUM';
            
            gaps.push({
                start: expectedNext,
                end: current - 1,
                size: gapSize,
                riskLevel,
                missingIds
            });
            
            totalMissingDocuments += gapSize;
            if (gapSize > largestGap) {
                largestGap = gapSize;
            }
        }
    }
    
    // Detectar patrones sospechosos
    const suspiciousPatterns: string[] = [];
    
    // 1. Múltiples gaps grandes
    const largeGaps = gaps.filter(g => g.size >= 10);
    if (largeGaps.length >= 3) {
        suspiciousPatterns.push(`${largeGaps.length} gaps grandes detectados - posible eliminación sistemática`);
    }
    
    // 2. Gap muy grande al final
    if (gaps.length > 0) {
        const lastGap = gaps[gaps.length - 1];
        if (lastGap.size >= 100) {
            suspiciousPatterns.push(`Gap de ${lastGap.size} documentos al final de la secuencia - posible ocultamiento reciente`);
        }
    }
    
    // 3. Patrón de gaps regulares (posible eliminación sistemática)
    if (gaps.length >= 3) {
        const gapSizes = gaps.map(g => g.size);
        const avgGapSize = gapSizes.reduce((sum, size) => sum + size, 0) / gapSizes.length;
        const regularGaps = gapSizes.filter(size => Math.abs(size - avgGapSize) / avgGapSize < 0.3);
        
        if (regularGaps.length >= 3) {
            suspiciousPatterns.push(`Patrón regular de gaps (tamaño promedio: ${avgGapSize.toFixed(1)}) - posible eliminación sistemática`);
        }
    }
    
    // 4. Alto porcentaje de documentos faltantes
    const totalRange = uniqueIds[uniqueIds.length - 1] - uniqueIds[0] + 1;
    const missingPercentage = (totalMissingDocuments / totalRange) * 100;
    
    if (missingPercentage > 20) {
        suspiciousPatterns.push(`${missingPercentage.toFixed(1)}% de documentos faltantes - integridad comprometida`);
    }
    
    return {
        gaps: gaps.sort((a, b) => b.size - a.size), // Ordenar por tamaño descendente
        totalGaps: gaps.length,
        totalMissingDocuments,
        largestGap,
        suspiciousPatterns
    };
}

export function parseCurrency(value: any): number {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;

    let str = String(value).trim();
    if (!str) return 0;

    // Detectar formato Europeo/Latino (1.000,00) vs US (1,000.00)
    // Si tiene comas y puntos, y la ultima coma está DESPUÉS del último punto -> Es Europeo (1.234,56)
    if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            // Eliminar puntos (miles), reemplazar coma por punto (decimal)
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // US: Eliminar comas
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        // Ambiguo: 1,000 o 10,50
        // Si hay mas de una coma, es separador miles (1,000,000) -> US
        if ((str.match(/,/g) || []).length > 1) {
            str = str.replace(/,/g, '');
        } else {
            // Una sola coma.
            // Si seguida de 3 digitos exactos y fin cadena -> Probable miles (1,000) -> US
            // Si seguida de 2 digitos -> Decimal (10,50) -> EU
            // Asumimos EU (Decimal) por defecto en UI Español, salvo que parezca miles
            if (/\,\d{3}$/.test(str)) {
                str = str.replace(/,/g, ''); // Miles US
            } else {
                str = str.replace(',', '.'); // Decimal EU
            }
        }
    } else if (str.includes('.')) {
        // Ambiguo: 1.000 o 10.50
        // Mismo caso pero invertido.
        if ((str.match(/\./g) || []).length > 1) {
            str = str.replace(/\./g, ''); // Miles EU
        } else {
            if (/\.\d{3}$/.test(str)) {
                str = str.replace(/\./g, ''); // Miles EU
            }
            // Si no, asumimos que es punto decimal standard (US)
        }
    }

    // Limpiar cualquier otro caracter (excepto punto y menos)
    const clean = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

export const performRiskProfiling = (rows: any[], population: AuditPopulation, forensicConfig?: {
    splittingThresholds?: number[];
    timeWindow?: number;
    entropyThreshold?: number;
}): RiskAnalysisResult => {
    const riskCriteria = {
        highValueConfig: 10000, // Umbral por defecto
        suspiciousTimeStart: 20, // 8 PM
        suspiciousTimeEnd: 6    // 6 AM
    };

    const mapping = population.column_mapping || {} as any;
    const monetaryValue = mapping.monetaryValue;
    const dateCol = mapping.date;
    const vendorCol = mapping.vendor;

    let totalRiskScore = 0; // Suma acumulada de scores
    let gapAlerts = 0;              // Cantidad de hallazgos significativos

    // Initialize Benford digit counts and duplicate tracking
    const digitCounts = new Array(10).fill(0);
    const duplicateMap = new Map<string, number>();

    // Helper function to generate intelligent duplicate keys based on available mapping
    const generateDuplicateKey = (rawData: any, mapping: any): string => {
        const parts: string[] = [];
        
        // 1. SIEMPRE incluir el Campo Único (obligatorio)
        const uniqueId = rawData[mapping.uniqueId] || '';
        parts.push(String(uniqueId));
        
        // 2. Si tiene MONTO definido -> Usar: Campo Único + Monto
        if (mapping.monetaryValue && rawData[mapping.monetaryValue] !== undefined) {
            const monetaryValue = parseCurrency(rawData[mapping.monetaryValue]);
            parts.push(String(monetaryValue));
            return parts.join('_');
        }
        
        // 3. Si NO tiene monto pero SÍ tiene Categoría/Subcategoría -> Usar: Campo Único + Categoría + Subcategoría
        if (mapping.category || mapping.subcategory) {
            if (mapping.category) {
                parts.push(String(rawData[mapping.category] || ''));
            }
            if (mapping.subcategory) {
                parts.push(String(rawData[mapping.subcategory] || ''));
            }
            return parts.join('_');
        }
        
        // 4. Si SOLO tiene Campo Único -> Usar únicamente ese campo
        return parts.join('_');
    };

    // First pass: collect all monetary values and count digits/duplicates
    const monetaryValues: number[] = [];
    rows.forEach(r => {
        const raw = r.raw_json || {};
        const m = parseCurrency(raw[monetaryValue || '']);
        monetaryValues.push(m);
        
        // Count leading digits for Benford analysis
        if (m > 0) {
            const leadingDigit = parseInt(String(Math.abs(m)).charAt(0));
            if (leadingDigit >= 1 && leadingDigit <= 9) {
                digitCounts[leadingDigit]++;
            }
        }
        
        // Track duplicates using intelligent key generation
        const duplicateKey = generateDuplicateKey(raw, mapping);
        duplicateMap.set(duplicateKey, (duplicateMap.get(duplicateKey) || 0) + 1);
    });

    // Calculate total non-zero values for Benford analysis
    const totalNonZero = monetaryValues.filter(m => m > 0).length;

    const updatedRows = rows.map((r, index) => {
        const raw = r.raw_json || {};
        const m = monetaryValues[index]; // Use pre-calculated value
        const dStr = raw[dateCol || ''];

        let score = 0;
        const factors: string[] = [];

        // 1. High Value Check
        if (m > riskCriteria.highValueConfig) {
            score += 20;
            factors.push('HIGH_VALUE');
        }

        // 2. Benford's Law Analysis (Fixed Implementation)
        if (m > 0 && totalNonZero > 0) {
            const leadingDigit = parseInt(String(Math.abs(m)).charAt(0));
            if (leadingDigit >= 1 && leadingDigit <= 9) {
                const actualFreq = (digitCounts[leadingDigit] / totalNonZero) * 100;
                const expectedFreq = BENFORD_PROBABILITIES[leadingDigit - 1];
                
                // Mark as suspicious if deviation > 5%
                if (Math.abs(actualFreq - expectedFreq) > 5) {
                    score += 10;
                    factors.push('BENFORD_ANOMALY');
                }
            }
        }

        // 3. Weekend/Night Check
        if (dStr) {
            const date = new Date(dStr);
            if (!isNaN(date.getTime())) {
                const hour = date.getHours();
                const day = date.getDay();
                if (day === 0 || day === 6) {
                    score += 15;
                    factors.push('WEEKEND');
                }
                if (hour >= riskCriteria.suspiciousTimeStart || hour <= riskCriteria.suspiciousTimeEnd) {
                    score += 15;
                    factors.push('OFF_HOURS');
                }
            }
        }

        // 4. Round Amounts
        if (m > 100 && m % 100 === 0) {
            score += 10;
            factors.push('ROUND_AMOUNT');
        }

        // 5. Keyword Search in Vendor
        if (vendorCol && raw[vendorCol]) {
            const v = String(raw[vendorCol]).toLowerCase();
            if (v.includes('unknown') || v.includes('sin nombre') || v.includes('efectivo')) {
                score += 30;
                factors.push('SUSPICIOUS_VENDOR');
            }
        }

        // 6. Duplicate Detection (Improved with Intelligent Key Generation)
        const duplicateKey = generateDuplicateKey(raw, mapping);
        const duplicateCount = duplicateMap.get(duplicateKey) || 0;
        if (duplicateCount > 1) {
            score += 15;
            factors.push('DUPLICATE_TRANSACTION');
        }

        // 7. Statistical Outlier Detection (will be refined after IQR calculation)
        if (m > riskCriteria.highValueConfig * 5) {
            score += 25;
            factors.push('STATISTICAL_OUTLIER');
        }

        totalRiskScore += score;
        if (score > 40) gapAlerts++;

        return {
            ...r,
            monetary_value_col: m, // Actualizamos columna auxiliar para BBDD
            risk_score: score,
            risk_factors: factors
        };
    });

    // Realizar análisis de entropía
    const entropyAnalysis = performEntropyAnalysis(rows, mapping);
    
    // Realizar análisis de fraccionamiento
    const splittingAnalysis = performSplittingAnalysis(rows, mapping, forensicConfig?.splittingThresholds);
    
    // Realizar análisis de integridad secuencial
    const sequentialAnalysis = performSequentialAnalysis(rows, mapping);
    
    // Realizar análisis de Isolation Forest
    const isolationForestAnalysis = performIsolationForestAnalysis(rows, mapping);
    
    // Realizar análisis de Actor Profiling
    const actorProfilingAnalysis = performActorProfilingAnalysis(rows, mapping);
    
    // Realizar análisis mejorado de Benford
    const enhancedBenfordAnalysis = performEnhancedBenfordAnalysis(rows, mapping);
    
    // Agregar factores de riesgo basados en entropía
    updatedRows.forEach(r => {
        const raw = r.raw_json || {};
        const cat = raw[mapping.category] || 'NULL';
        const subcat = raw[mapping.subcategory] || 'NULL';
        const combo = `${cat}_${subcat}`;
        
        // Verificar si esta combinación es anómala
        const anomaly = entropyAnalysis.anomalousCategories.find(a => a.combination === combo);
        if (anomaly) {
            const entropyScore = anomaly.riskLevel === 'HIGH' ? 20 : (anomaly.riskLevel === 'MEDIUM' ? 10 : 5);
            r.risk_score = (r.risk_score || 0) + entropyScore;
            r.risk_factors = [...(r.risk_factors || []), 'ENTROPY_ANOMALY'];
            
            if (anomaly.riskLevel === 'HIGH') {
                gapAlerts++;
            }
        }
        
        // Verificar si esta transacción es parte de un grupo de fraccionamiento
        const splittingGroup = splittingAnalysis.suspiciousGroups.find(g => 
            g.transactions.some(t => t.id === r.unique_id_col)
        );
        if (splittingGroup) {
            const splittingScore = splittingGroup.riskLevel === 'HIGH' ? 25 : (splittingGroup.riskLevel === 'MEDIUM' ? 15 : 10);
            r.risk_score = (r.risk_score || 0) + splittingScore;
            r.risk_factors = [...(r.risk_factors || []), 'SPLITTING_DETECTED'];
            
            if (splittingGroup.riskLevel === 'HIGH') {
                gapAlerts++;
            }
        }
        
        // Verificar si hay gaps secuenciales significativos (aplica a toda la población)
        if (sequentialAnalysis.totalGaps > 0) {
            const gapRiskScore = sequentialAnalysis.largestGap >= 50 ? 15 : (sequentialAnalysis.largestGap >= 10 ? 10 : 5);
            
            // Solo agregar si hay gaps significativos
            if (sequentialAnalysis.largestGap >= 5) {
                r.risk_score = (r.risk_score || 0) + gapRiskScore;
                r.risk_factors = [...(r.risk_factors || []), 'SEQUENTIAL_GAPS'];
                
                if (sequentialAnalysis.largestGap >= 50) {
                    gapAlerts++;
                }
            }
        }
        
        // Verificar si esta transacción es una anomalía de Isolation Forest
        const isolationAnomaly = isolationForestAnalysis.anomalies.find(a => a.id === r.unique_id_col);
        if (isolationAnomaly) {
            const isolationScore = isolationAnomaly.riskLevel === 'HIGH' ? 20 : 
                                 isolationAnomaly.riskLevel === 'MEDIUM' ? 15 : 10;
            r.risk_score = (r.risk_score || 0) + isolationScore;
            r.risk_factors = [...(r.risk_factors || []), 'ML_ANOMALY'];
            
            if (isolationAnomaly.riskLevel === 'HIGH') {
                gapAlerts++;
            }
        }
        
        // Verificar si el usuario de esta transacción es un actor sospechoso
        const rawData = r.raw_json || {};
        const userId = rawData[mapping.user];
        if (userId) {
            const suspiciousActor = actorProfilingAnalysis.suspiciousActors.find(a => a.actorId === userId);
            if (suspiciousActor) {
                const actorScore = suspiciousActor.riskLevel === 'HIGH' ? 25 : 
                                suspiciousActor.riskLevel === 'MEDIUM' ? 15 : 10;
                r.risk_score = (r.risk_score || 0) + actorScore;
                r.risk_factors = [...(r.risk_factors || []), 'SUSPICIOUS_ACTOR'];
                
                if (suspiciousActor.riskLevel === 'HIGH') {
                    gapAlerts++;
                }
            }
        }
        
        // Verificar patrones sospechosos en análisis mejorado de Benford
        const monetaryValue = parseCurrency(rawData[mapping.monetaryValue]);
        if (monetaryValue > 0) {
            const valueStr = Math.abs(monetaryValue).toString();
            
            // Verificar primer dígito
            if (valueStr.length >= 1) {
                const firstDigit = parseInt(valueStr.charAt(0));
                const suspiciousFirstDigit = enhancedBenfordAnalysis.suspiciousDigitPatterns.find(p => 
                    p.type === 'FIRST_DIGIT' && p.digitCombination.includes(firstDigit.toString())
                );
                
                if (suspiciousFirstDigit && suspiciousFirstDigit.riskLevel !== 'LOW') {
                    const benfordScore = suspiciousFirstDigit.riskLevel === 'HIGH' ? 15 : 10;
                    r.risk_score = (r.risk_score || 0) + benfordScore;
                    r.risk_factors = [...(r.risk_factors || []), 'ENHANCED_BENFORD_FIRST'];
                    
                    if (suspiciousFirstDigit.riskLevel === 'HIGH') {
                        gapAlerts++;
                    }
                }
            }
            
            // Verificar segundo dígito
            if (valueStr.length >= 2) {
                const secondDigit = parseInt(valueStr.charAt(1));
                const suspiciousSecondDigit = enhancedBenfordAnalysis.suspiciousDigitPatterns.find(p => 
                    p.type === 'SECOND_DIGIT' && p.digitCombination.includes(secondDigit.toString())
                );
                
                if (suspiciousSecondDigit && suspiciousSecondDigit.riskLevel !== 'LOW') {
                    const benfordScore = suspiciousSecondDigit.riskLevel === 'HIGH' ? 12 : 8;
                    r.risk_score = (r.risk_score || 0) + benfordScore;
                    r.risk_factors = [...(r.risk_factors || []), 'ENHANCED_BENFORD_SECOND'];
                    
                    if (suspiciousSecondDigit.riskLevel === 'HIGH') {
                        gapAlerts++;
                    }
                }
            }
        }
    });

    const avgScore = updatedRows.length > 0 ? totalRiskScore / updatedRows.length : 0;

    // --- EDA CALCULATION (IMPROVED) ---
    let netSum = 0;
    let absSum = 0;
    let positiveSum = 0;
    let negativeSum = 0;
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;
    let maxId: string | number | undefined;
    let minId: string | number | undefined;
    let positiveCount = 0;
    let negativeCount = 0;
    let zeroCount = 0;
    let values: number[] = [];
    let correctDataCount = 0;
    let errorDataCount = 0;

    updatedRows.forEach(r => {
        let m = r.monetary_value_col; // Already parsed above

        if (m === null || m === undefined || isNaN(m)) {
            errorDataCount++;
            return;
        }

        correctDataCount++;
        netSum += m;
        absSum += Math.abs(m);
        values.push(m);

        if (m > 0) {
            positiveSum += m;
            positiveCount++;
        } else if (m < 0) {
            negativeSum += m;
            negativeCount++;
        } else {
            zeroCount++;
        }

        if (m > max) {
            max = m;
            maxId = r.unique_id_col;
        }
        if (m < min) {
            min = m;
            minId = r.unique_id_col;
        }
    });

    // Calculate statistical measures
    const meanValue = correctDataCount > 0 ? netSum / correctDataCount : 0;
    
    // Standard deviation calculation
    let variance = 0;
    if (correctDataCount > 1) {
        const sumSquaredDiffs = values.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0);
        variance = sumSquaredDiffs / (correctDataCount - 1); // Sample variance
    }
    const sampleStdDev = Math.sqrt(variance);
    const populationVariance = correctDataCount > 0 ? variance * (correctDataCount - 1) / correctDataCount : 0;
    const populationStdDev = Math.sqrt(populationVariance);
    
    // Skewness calculation (Pearson's moment coefficient of skewness)
    let skewness = 0;
    if (correctDataCount > 2 && sampleStdDev > 0) {
        const sumCubedDiffs = values.reduce((sum, val) => sum + Math.pow((val - meanValue) / sampleStdDev, 3), 0);
        skewness = (correctDataCount / ((correctDataCount - 1) * (correctDataCount - 2))) * sumCubedDiffs;
    }
    
    // Kurtosis calculation (excess kurtosis)
    let kurtosis = 0;
    if (correctDataCount > 3 && sampleStdDev > 0) {
        const sumFourthDiffs = values.reduce((sum, val) => sum + Math.pow((val - meanValue) / sampleStdDev, 4), 0);
        const n = correctDataCount;
        kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumFourthDiffs - 
                   (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
    }

    // Count actual duplicates
    const duplicatesCount = Array.from(duplicateMap.values()).filter(count => count > 1).length;
    
    // Calculate outliers using IQR method
    const sortedValues = values.filter(v => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
    let outlierThreshold = riskCriteria.highValueConfig * 5; // Default threshold
    
    if (sortedValues.length > 4) {
        const q1Index = Math.floor(sortedValues.length * 0.25);
        const q3Index = Math.floor(sortedValues.length * 0.75);
        const q1 = sortedValues[q1Index];
        const q3 = sortedValues[q3Index];
        const iqr = q3 - q1;
        
        // Outlier threshold: Q3 + 1.5 * IQR
        if (iqr > 0) {
            outlierThreshold = q3 + (1.5 * iqr);
        }
    }
    
    // Update outlier detection in rows (second pass)
    let iqrOutlierCount = 0;
    updatedRows.forEach(r => {
        const m = r.monetary_value_col || 0;
        if (m > outlierThreshold && !r.risk_factors?.includes('STATISTICAL_OUTLIER')) {
            r.risk_score = (r.risk_score || 0) + 15;
            r.risk_factors = [...(r.risk_factors || []), 'IQR_OUTLIER'];
            iqrOutlierCount++;
        }
    });

    // Benford Score (MAD - Mean Absolute Deviation)
    let benfordDev = 0;
    if (totalNonZero > 0) {
        for (let i = 1; i <= 9; i++) {
            const observed = (digitCounts[i] / totalNonZero) * 100;
            const expected = BENFORD_PROBABILITIES[i - 1];
            benfordDev += Math.abs(observed - expected);
        }
        benfordDev /= 9;
    }

    // Construct proper Benford Analysis Array
    const benfordAnalysis: BenfordAnalysis[] = new Array(9).fill(0).map((_, i) => {
        const d = i + 1;
        const observedFreq = totalNonZero > 0 ? (digitCounts[d] / totalNonZero) * 100 : 0;
        const expectedFreq = BENFORD_PROBABILITIES[d - 1];

        return {
            digit: d,
            expectedFreq,
            actualFreq: observedFreq,
            actualCount: digitCounts[d],
            isSuspicious: Math.abs(observedFreq - expectedFreq) > 5 // Simple threshold
        };
    });

    // Calculate RSF (Relative Size Factor)
    let rsf: RelativeSizeFactor | undefined;
    if (sortedValues.length >= 2) {
        const topValue = sortedValues[sortedValues.length - 1];
        const secondTopValue = sortedValues[sortedValues.length - 2];
        if (secondTopValue > 0) {
            rsf = {
                topValue,
                secondTopValue,
                rsf: topValue / secondTopValue,
                topId: maxId || ''
            };
        }
    }

    const edaMetrics: EdaMetrics = {
        netValue: netSum,
        absoluteValue: absSum,
        totalRecords: correctDataCount,
        zerosCount: zeroCount,
        positiveValue: positiveSum,
        negativeValue: negativeSum,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        errorDataCount,
        correctDataCount,
        meanValue: meanValue,
        minValue: min === Number.POSITIVE_INFINITY ? 0 : min,
        maxValue: max === Number.NEGATIVE_INFINITY ? 0 : max,
        minId,
        maxId,
        sampleStdDev: sampleStdDev,
        sampleVariance: variance,
        populationStdDev: populationStdDev,
        populationVariance: populationVariance,
        skewness: skewness,
        kurtosis: kurtosis,
        rsf
    };

    const advancedAnalysis: AdvancedAnalysis = {
        benford: benfordAnalysis,
        outliersCount: updatedRows.filter(r => 
            r.risk_factors?.includes('STATISTICAL_OUTLIER') || 
            r.risk_factors?.includes('IQR_OUTLIER')
        ).length,
        outliersThreshold: outlierThreshold,
        duplicatesCount: duplicatesCount,
        zerosCount: zeroCount,
        negativesCount: negativeCount,
        roundNumbersCount: updatedRows.filter(r => r.risk_factors?.includes('ROUND_AMOUNT')).length,
        forensicDiscovery: population.advanced_analysis?.forensicDiscovery || [],
        eda: edaMetrics,
        entropy: {
            categoryEntropy: entropyAnalysis.categoryEntropy,
            subcategoryEntropy: entropyAnalysis.subcategoryEntropy,
            conditionalEntropy: entropyAnalysis.conditionalEntropy,
            mutualInformation: entropyAnalysis.mutualInformation,
            informationGain: entropyAnalysis.informationGain,
            anomalousCount: entropyAnalysis.anomalousCategories.length,
            highRiskCombinations: entropyAnalysis.anomalousCategories.filter(a => a.riskLevel === 'HIGH').length
        },
        splitting: {
            suspiciousVendors: splittingAnalysis.suspiciousGroups.length,
            totalSuspiciousTransactions: splittingAnalysis.totalSuspiciousTransactions,
            averageRiskScore: splittingAnalysis.averageRiskScore,
            highRiskGroups: splittingAnalysis.suspiciousGroups.filter(g => g.riskLevel === 'HIGH').length
        },
        sequential: {
            totalGaps: sequentialAnalysis.totalGaps,
            totalMissingDocuments: sequentialAnalysis.totalMissingDocuments,
            largestGap: sequentialAnalysis.largestGap,
            highRiskGaps: sequentialAnalysis.gaps.filter(g => g.riskLevel === 'HIGH').length,
            suspiciousPatterns: sequentialAnalysis.suspiciousPatterns.length
        },
        isolationForest: {
            totalAnomalies: isolationForestAnalysis.totalAnomalies,
            averagePathLength: isolationForestAnalysis.averagePathLength,
            anomalyThreshold: isolationForestAnalysis.anomalyThreshold,
            highRiskAnomalies: isolationForestAnalysis.anomalies.filter(a => a.riskLevel === 'HIGH').length
        },
        actorProfiling: {
            totalSuspiciousActors: actorProfilingAnalysis.totalSuspiciousActors,
            averageRiskScore: actorProfilingAnalysis.averageRiskScore,
            highRiskActors: actorProfilingAnalysis.suspiciousActors.filter(a => a.riskLevel === 'HIGH').length,
            behaviorPatterns: actorProfilingAnalysis.behaviorPatterns.length
        },
        enhancedBenford: {
            firstDigitDeviation: enhancedBenfordAnalysis.firstDigitAnalysis.meanAbsoluteDeviation,
            secondDigitDeviation: enhancedBenfordAnalysis.secondDigitAnalysis.meanAbsoluteDeviation,
            overallDeviation: enhancedBenfordAnalysis.overallDeviation,
            suspiciousPatterns: enhancedBenfordAnalysis.suspiciousDigitPatterns.length,
            highRiskPatterns: enhancedBenfordAnalysis.suspiciousDigitPatterns.filter(p => p.riskLevel === 'HIGH').length,
            isFirstDigitSignificant: enhancedBenfordAnalysis.firstDigitAnalysis.isSignificant,
            isSecondDigitSignificant: enhancedBenfordAnalysis.secondDigitAnalysis.isSignificant,
            conformityLevel: enhancedBenfordAnalysis.conformityLevel,
            conformityDescription: enhancedBenfordAnalysis.conformityDescription,
            conformityRiskLevel: enhancedBenfordAnalysis.conformityRiskLevel
        }
    };

    return {
        updatedRows,
        profile: {
            totalRiskScore: avgScore,
            gapAlerts: gapAlerts,
            riskDistribution: [
                { range: 'Low (0-20)', count: updatedRows.filter(r => (r.risk_score || 0) <= 20).length },
                { range: 'Medium (21-40)', count: updatedRows.filter(r => (r.risk_score || 0) > 20 && (r.risk_score || 0) <= 40).length },
                { range: 'High (41-60)', count: updatedRows.filter(r => (r.risk_score || 0) > 40 && (r.risk_score || 0) <= 60).length },
                { range: 'Critical (>60)', count: updatedRows.filter(r => (r.risk_score || 0) > 60).length }
            ],
            topRiskCategories: [
                { name: 'High Value', score: updatedRows.filter(r => r.risk_factors?.includes('HIGH_VALUE')).length, alert: 'WARNING' as const },
                { name: 'Benford Anomaly', score: updatedRows.filter(r => r.risk_factors?.includes('BENFORD_ANOMALY')).length, alert: 'INFO' as const },
                { name: 'Duplicates', score: updatedRows.filter(r => r.risk_factors?.includes('DUPLICATE_TRANSACTION')).length, alert: 'CRITICAL' as const },
                { name: 'Round Numbers', score: updatedRows.filter(r => r.risk_factors?.includes('ROUND_AMOUNT')).length, alert: 'INFO' as const },
                { name: 'Weekend/Off Hours', score: updatedRows.filter(r => r.risk_factors?.includes('WEEKEND') || r.risk_factors?.includes('OFF_HOURS')).length, alert: 'WARNING' as const },
                { name: 'Entropy Anomalies', score: updatedRows.filter(r => r.risk_factors?.includes('ENTROPY_ANOMALY')).length, alert: 'INFO' as const },
                { name: 'Splitting Detected', score: updatedRows.filter(r => r.risk_factors?.includes('SPLITTING_DETECTED')).length, alert: 'CRITICAL' as const },
                { name: 'Sequential Gaps', score: updatedRows.filter(r => r.risk_factors?.includes('SEQUENTIAL_GAPS')).length, alert: 'WARNING' as const },
                { name: 'ML Anomalies', score: updatedRows.filter(r => r.risk_factors?.includes('ML_ANOMALY')).length, alert: 'INFO' as const },
                { name: 'Suspicious Actors', score: updatedRows.filter(r => r.risk_factors?.includes('SUSPICIOUS_ACTOR')).length, alert: 'WARNING' as const },
                { name: 'Enhanced Benford 1st', score: updatedRows.filter(r => r.risk_factors?.includes('ENHANCED_BENFORD_FIRST')).length, alert: 'INFO' as const },
                { name: 'Enhanced Benford 2nd', score: updatedRows.filter(r => r.risk_factors?.includes('ENHANCED_BENFORD_SECOND')).length, alert: 'INFO' as const }
            ]
        },
        advancedAnalysis
    };
};
