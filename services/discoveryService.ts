import { ForensicTest, ColumnMapping } from '../types';

export const FORENSIC_LIBRARY: ForensicTest[] = [
    {
        id: 'entropy',
        name: 'Análisis de Entropía',
        description: 'Detecta combinaciones inusuales entre categorías.',
        requiredColumns: ['category', 'subcategory'],
        icon: 'fa-microchip',
        active: false
    },
    {
        id: 'isolation',
        name: 'Isolation Forest',
        description: 'Identifica registros solitarios anómalos.',
        requiredColumns: ['monetaryValue', 'category', 'date'],
        icon: 'fa-expand-arrows-alt',
        active: false
    },
    {
        id: 'gaps',
        name: 'Integridad Secuencial',
        description: 'Encuentra saltos en la numeración secuencial.',
        requiredColumns: ['sequentialId'],
        icon: 'fa-barcode',
        active: false
    },
    {
        id: 'actors',
        name: 'Perfilado de Actores',
        description: 'Cruza registros con usuarios de riesgo.',
        requiredColumns: ['user'],
        icon: 'fa-user-secret',
        active: false
    },
    {
        id: 'splitting',
        name: 'Detección de Fraccionamiento',
        description: 'Identifica compras divididas para evadir umbrales.',
        requiredColumns: ['monetaryValue', 'vendor', 'date'],
        icon: 'fa-scissors',
        active: false
    },
    {
        id: 'timestamps',
        name: 'Horarios Sospechosos',
        description: 'Analiza registros creados fuera de horario laboral.',
        requiredColumns: ['timestamp'],
        icon: 'fa-clock',
        active: false
    }
];

export interface DiscoveryAnalysis {
    suggestedTests: ForensicTest[];
    suggestedMapping: Partial<ColumnMapping>;
}

/**
 * Motor Heurístico de Descubrimiento (Simulación de IA en Frontend)
 * Analiza cabeceras mediante coincidencia de patrones semánticos.
 */
export const scanHeadersAndSuggestTests = async function (headers: string[], isDeep: boolean, sampleData?: any[]): Promise<DiscoveryAnalysis> {
    // Simular retardo de procesamiento para UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mapping: Partial<ColumnMapping> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Heurística de Mapeo
    headers.forEach(h => {
        const lh = h.toLowerCase();
        if (lh.includes('id') || lh.includes('num') || lh.includes('referencia')) mapping.uniqueId = h;
        if (lh.includes('monto') || lh.includes('valor') || lh.includes('total') || lh.includes('importe') || lh.includes('amount') || lh.includes('debe') || lh.includes('haber') || lh.includes('saldo') || lh.includes('balance')) mapping.monetaryValue = h;
        if (lh.includes('fecha') || lh.includes('date')) mapping.date = h;
        if (lh.includes('cat') || lh.includes('grupo') || lh.includes('tipo')) mapping.category = h;
        if (lh.includes('usu') || lh.includes('user') || lh.includes('creado')) mapping.user = h;
        if (lh.includes('prov') || lh.includes('vend') || lh.includes('tercero')) mapping.vendor = h;
        if (lh.includes('hora') || lh.includes('time')) mapping.timestamp = h;
        if (lh.includes('sec') || lh.includes('folio')) mapping.sequentialId = h;
    });

    // Sugerencia de Pruebas basada en campos disponibles
    const suggestedTests = FORENSIC_LIBRARY.map(test => {
        const hasAllColumns = test.requiredColumns.every(col => !!(mapping as any)[col]);
        return {
            ...test,
            active: hasAllColumns,
            aiRecommendation: hasAllColumns ? `Aplicable por detección de columnas [${test.requiredColumns.join(', ')}]` : undefined
        };
    });

    return {
        suggestedTests,
        suggestedMapping: mapping
    };
};
