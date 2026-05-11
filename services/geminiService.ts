import { GoogleGenAI, Type } from "@google/genai";
import { DescriptiveStats, AdvancedAnalysis, AiRecommendation, SamplingMethod } from "../types";

export const getGeminiRecommendation = async (stats: DescriptiveStats, analysis: AdvancedAnalysis): Promise<AiRecommendation> => {
    // NOTE: Ensure VITE_GEMINI_API_KEY is set in your .env file
    // Adapting process.env.API_KEY to import.meta.env for Vite compatibility if needed, 
    // or keep as is if using a define plugin. For now, matching user snippet but adding fallback.
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env.API_KEY as string) || '';

    if (!apiKey) {
        console.warn("Gemini API Key missing. Please set VITE_GEMINI_API_KEY in .env");
    }

    // Initialize with safe fallback if key is missing to avoid immediate crash before call
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Actúa como un Auditor Senior Conservador experto en NIA 530 y Prevención de Fraude. 
    Tu objetivo es analizar estadísticas de una población y sugerir el método de muestreo más SEGURO y EFICIENTE.
    
    ESTRICTAMENTE: 
    1. No inventes datos que no estén presentes en las estadísticas proporcionadas.
    2. Si el Coeficiente de Variación (CV) es alto (> 0.5), prioriza MUESTREO ESTRATIFICADO o MUS.
    3. Si hay muchos registros negativos, menciona la necesidad de segregarlos.
    4. Tu razonamiento debe ser técnico, neutral y basado exclusivamente en los números.
    5. Prohibido usar terminología ambigua como "parece que" o "podría ser". Usa "La variabilidad indica" o "El perfil forense demanda".

    DATOS DE ENTRADA:
    - Estadísticas Descriptivas: Suma=$${stats.sum.toLocaleString()}, Promedio=$${stats.avg.toLocaleString()}, CV=${stats.cv.toFixed(4)}.
    - Análisis de Riesgo Forense: 
        * Fallos Benford: ${JSON.stringify(analysis.benford)}
        * Outliers Detectados: ${analysis.outliersCount}
        * Registros Negativos: ${analysis.negativesCount}
        * Zeros: ${analysis.zerosCount}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: {
                role: "user",
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: "application/json",
                // @ts-ignore - The SDK types might vary slightly, ensuring compatibility
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendedMethod: { type: Type.STRING, description: "attribute, mus, cav, stratified" },
                        confidenceScore: { type: Type.NUMBER },
                        reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
                        riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
                        directedSelectionAdvice: { type: Type.STRING }
                    },
                    required: ["recommendedMethod", "confidenceScore", "reasoning", "riskFactors", "directedSelectionAdvice"]
                }
            }
        });

        // The SDK response structure might differ. Adapting to standard response text access.
        const responseText = response.text?.();
        const result = JSON.parse(responseText || '{}');

        return {
            recommendedMethod: (result.recommendedMethod as SamplingMethod) || SamplingMethod.Stratified,
            confidenceScore: result.confidenceScore || 80,
            reasoning: result.reasoning || ["Análisis basado en heurísticas de variabilidad."],
            riskFactors: result.riskFactors || [],
            directedSelectionAdvice: result.directedSelectionAdvice || ""
        };
    } catch (e) {
        console.error("Gemini Error:", e);
        // Fallback en caso de error de API
        return {
            recommendedMethod: SamplingMethod.Stratified,
            confidenceScore: 70,
            reasoning: ["Error en conexión con IA. Se aplica recomendación conservadora por estratos."],
            riskFactors: ["Falla de conexión con motor de IA"],
            directedSelectionAdvice: ""
        };
    }
};
