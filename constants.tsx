
import React from 'react';
import { RichInfoCard } from './components/ui/RichInfoCard';

export const InfoIcon = () => (
    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors duration-200 cursor-pointer shadow-sm border border-blue-200">
        <i className="fas fa-info text-xs font-bold"></i>
    </div>
);

export const WarningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

// --- CONSTANTES TÉCNICAS ---
export const RISK_MESSAGES = {
    PILOT_PHASE: 'FASE PILOTO: Evaluación inicial de desviaciones (Stop-or-Go).',
    TECH_EXPANSION_JUSTIFICATION: 'Ampliación técnica requerida por nivel de variabilidad detectado.',
    PILOT_JUSTIFICATION: 'Calibración de parámetros sobre muestra inicial.',
    CAV_PILOT_JUSTIFICATION: 'Estimación de desviación estándar operativa.',
    TECH_EXPANSION: 'AMPLIACIÓN TÉCNICA'
};

export const METHODOLOGY_NOTES = {
    STOP_OR_GO: 'Estrategia Stop-or-Go activada: Se inicia con n=25 según NIA 530.',
    TECH_EXPANSION: 'Ampliación por Variabilidad: El tamaño de muestra se ajustó tras la fase piloto.',
    MUS_PILOT: 'MUS Fase Piloto: Selección inicial para calibración de parámetros.',
    CAV_PILOT: 'CAV Fase Piloto: Selección inicial para estimación de σ.'
};

export const PILOT_PHASE = 'PILOT_PHASE';
export const STOP_OR_GO = 'STOP_OR_GO';

export const ASSISTANT_CONTENT = {
    poblacionTotal: {
        title: "Población (Universo)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Representa el conjunto completo de datos (N) sobre el cual se desea alcanzar una conclusión.
                </RichInfoCard>
                <RichInfoCard type="justification" title="Justificación Técnica">
                    En poblaciones grandes, el tamaño real tiene poco efecto, pero en universos pequeños (&lt; 500), el sistema aplica automáticamente el Factor de Corrección por Población Finita (FPCF) para evitar un sobremuestreo innecesario.
                </RichInfoCard>
            </div>
        )
    },
    nivelConfianza: {
        title: "Nivel de Confianza (NC)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Es el grado de seguridad deseado de que el porcentaje de desviación real en la población no excede el tolerable.
                </RichInfoCard>
                <RichInfoCard type="justification" title="Justificación Técnica">
                    Un incremento en el NC (ej. de 90% a 95%) aumenta directamente el tamaño de la muestra. Representa 1 - Riesgo de Aceptación Incorrecta (Riesgo Beta).
                </RichInfoCard>
            </div>
        )
    },
    desviacionTolerable: {
        title: "Desviación Tolerable (ET)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Es la tasa máxima de desviación que el auditor está dispuesto a aceptar sin invalidar el control. Funciona como un detector de calidad binario.
                </RichInfoCard>
                <RichInfoCard type="impact" title="Criterio de Evaluación">
                    Si la tasa proyectada (UEL) supera este umbral, el control se dictamina como Inefectivo según NIA 530.
                </RichInfoCard>
            </div>
        )
    },
    desviacionEsperada: {
        title: "Desviación Esperada (PE)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Es la tasa de error que el auditor anticipa encontrar basado en experiencia previa. Si la PE aumenta, la muestra crece para mantener la precisión.
                </RichInfoCard>
            </div>
        )
    },
    mus_ria: {
        title: "Riesgo de Aceptación Incorrecta (RIA)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Probabilidad de concluir que un control es eficaz cuando en realidad la tasa de error es superior a la tolerable.
                </RichInfoCard>
                <RichInfoCard type="impact" title="Relación con NC">
                    Un RIA del 5% equivale a un Nivel de Confianza del 95%.
                </RichInfoCard>
            </div>
        )
    },
    mus_intervalo: {
        title: "Intervalo de Muestreo (IM)",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Distancia monetaria entre cada selección (V / n). Cada partida que iguale o supere este monto es extraída automáticamente al 100%.
                </RichInfoCard>
            </div>
        )
    },
    mus_estrato: {
        title: "Estrato de Certeza",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Grupo de registros cuyo valor es tan alto que su exclusión representaría un riesgo inaceptable. Se auditan al 100%.
                </RichInfoCard>
            </div>
        )
    },
    valorTotalPoblacion: {
        title: 'Valor Total (V)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Suma absoluta de los importes monetarios de todos los ítems en la población.
                </RichInfoCard>
            </div>
        )
    },
    errorTolerable: {
        title: 'Error Tolerable (TE)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Monto máximo de error monetario que puede existir sin que los estados financieros estén materialmente incorrectos.
                </RichInfoCard>
            </div>
        )
    },
    erroresPrevistos: {
        title: 'Errores Previstos (EE)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Estimación del monto total de error que ya existe en la población.
                </RichInfoCard>
            </div>
        )
    },
    riesgoAceptacionIncorrecta: {
        title: 'Riesgo (RIA)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Probabilidad de concluir que el saldo es correcto cuando en realidad contiene un error material.
                </RichInfoCard>
            </div>
        )
    },
    desviacionEstandar: {
        title: 'Variabilidad (σ)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Medida de dispersión de los importes. A mayor variabilidad, mayor muestra necesaria.
                </RichInfoCard>
            </div>
        )
    },
    muestraPiloto: {
        title: 'Piloto',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Propósito">
                    Estimación de la variabilidad real (Sigma) antes de calcular el tamaño final.
                </RichInfoCard>
            </div>
        )
    },
    tecnicaEstimacion: {
        title: 'Estimación',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Métodos">
                    MPU (Media por Unidad), Diferencia o Razón.
                </RichInfoCard>
            </div>
        )
    },
    estratificacion: {
        title: 'Estratificación',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Propósito">
                    Dividir la población para reducir la variabilidad y el tamaño de muestra.
                </RichInfoCard>
            </div>
        )
    },
    tratamientoNegativos: {
        title: 'Tratamiento de Negativos',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Definición">
                    Define cómo se manejan los saldos acreedores en MUS (Segregar, Valor Cero o Absoluto).
                </RichInfoCard>
            </div>
        )
    },
    cantidadEstratos: {
        title: "Cantidad de Estratos",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Propósito">
                    Divide el universo en grupos homogéneos para reducir la varianza interna.
                </RichInfoCard>
                <RichInfoCard type="impact" title="Efecto">
                    A mayor número de estratos (bandas), mayor es la eficiencia del muestreo, permitiendo reducir n sin aumentar el riesgo.
                </RichInfoCard>
            </div>
        )
    },
    metodoAsignacion: {
        title: "Método de Asignación",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Algoritmo">
                    Define cómo se distribuye la muestra (n) entre los estratos (nh).
                </RichInfoCard>
                <RichInfoCard type="impact" title="Neyman vs Proporcional">
                    Neyman es óptimo para detectar fraudes o errores en poblaciones con alta variabilidad.
                </RichInfoCard>
            </div>
        )
    },
    umbralCerteza: {
        title: "Umbral de Certeza",
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Materialidad Individual">
                    Define un monto a partir del cual todos los registros se auditan al 100% (Capa de Certeza).
                </RichInfoCard>
            </div>
        )
    },
    mappingUniqueId: {
        title: 'ID Único',
        content: <RichInfoCard type="definition" title="Definición">Columna que identifica de forma inequívoca cada registro (ej. Nº de Factura, ID Transacción).</RichInfoCard>
    },
    mappingMonetary: {
        title: 'Valor Monetario',
        content: <RichInfoCard type="definition" title="Definición">Importe principal del registro sobre el cual se proyectarán los errores estadísticos.</RichInfoCard>
    },
    mappingCategory: {
        title: 'Categoría',
        content: <RichInfoCard type="definition" title="Definición">Variable cualitativa para segmentar o aplicar pruebas de duplicados y frecuencia.</RichInfoCard>
    },
    mappingSubcategory: {
        title: 'Subcategoría',
        content: <RichInfoCard type="definition" title="Definición">Segundo nivel de detalle para análisis multivariable o estratificación por ítems.</RichInfoCard>
    },
    mappingDate: {
        title: 'Fecha',
        content: <RichInfoCard type="definition" title="Definición">Fecha de la transacción, esencial para pruebas de corte y análisis temporal.</RichInfoCard>
    },
    mappingUser: {
        title: 'Usuario / Responsable',
        content: <RichInfoCard type="definition" title="Definición">Identifica quién ejecutó la acción, clave para detectar segregación de funciones.</RichInfoCard>
    },
    mappingVendor: {
        title: 'Proveedor / Cliente',
        content: <RichInfoCard type="definition" title="Definición">Entidad externa involucrada; permite detectar concentraciones de riesgo.</RichInfoCard>
    },
    mappingTimestamp: {
        title: 'Marca de Tiempo',
        content: <RichInfoCard type="definition" title="Definición">Hora exacta del registro para detectar actividad en horarios no laborales.</RichInfoCard>
    },
    upload_help: {
        title: 'Ayuda de Carga',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Instrucciones">
                    Cargue un archivo .xlsx o .csv. Asegúrese de que tenga encabezados claros.
                </RichInfoCard>
                <RichInfoCard type="impact" title="Requisitos">
                    Se requiere al menos una columna de ID único. Si va a realizar muestreo monetario, requiere una columna de valor.
                </RichInfoCard>
            </div>
        )
    },
    semilla: {
        title: 'Semilla Estadística (Seed)',
        content: (
            <div className="space-y-4">
                <RichInfoCard type="definition" title="Reproductibilidad">
                    Valor inicial para el generador de números pseudoaleatorios. Garantiza que la selección de la muestra pueda ser replicada idénticamente en el futuro.
                </RichInfoCard>
            </div>
        )
    }
};
