/**
 * 🗄️ SERVICIO DE ALMACENAMIENTO DE MUESTRAS
 * 
 * ✅ Guardado persistente en Supabase habilitado
 * ✅ Usa anon_key (seguro, no expone service_role_key)
 * ✅ Compatible con políticas RLS configuradas
 * 
 * REQUISITOS:
 * - Ejecutar script: fix_rls_samples.sql en Supabase
 * - Políticas RLS deben estar configuradas
 */

import { supabase } from './supabaseClient';
import { AuditResults, SamplingMethod } from '../types';

export interface SampleStorageData {
    population_id: string;
    method: SamplingMethod;
    objective: string;
    seed: number;
    sample_size: number;
    params_snapshot: any;
    results_snapshot: AuditResults;
    is_final: boolean;
    is_current: boolean;
}

export interface SaveSampleResult {
    id: string;
    created_at: string;
    method: string;
    duration_ms: number;
}

/**
 * 💾 GUARDAR MUESTRA EN SUPABASE
 * 
 * Guarda la muestra generada en la tabla audit_historical_samples
 * usando el cliente de Supabase con anon_key (seguro)
 */
export async function saveSample(data: SampleStorageData): Promise<SaveSampleResult> {
    console.log('💾 Guardando muestra en base de datos...');
    console.log(`   Población: ${data.population_id}`);
    console.log(`   Método: ${data.method}`);
    console.log(`   Tamaño: ${data.sample_size} ítems`);
    
    const startTime = Date.now();
    
    try {
        // Guardar en Supabase usando anon_key (seguro)
        const { data: savedSample, error } = await supabase
            .from('audit_historical_samples')
            .insert({
                population_id: data.population_id,
                method: data.method,
                objective: data.objective,
                seed: data.seed,
                sample_size: data.sample_size,
                params_snapshot: data.params_snapshot,
                results_snapshot: data.results_snapshot,
                is_final: data.is_final,
                is_current: data.is_current
            })
            .select('id, created_at')
            .single();
        
        if (error) {
            console.error('❌ Error guardando muestra:', error);
            console.error('   Código:', error.code);
            console.error('   Mensaje:', error.message);
            console.error('   Detalles:', error.details);
            throw new Error(`Error al guardar muestra: ${error.message}`);
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Muestra guardada exitosamente en ${duration}ms`);
        console.log(`   ID: ${savedSample.id}`);
        console.log(`   Fecha: ${savedSample.created_at}`);
        
        return {
            id: savedSample.id,
            created_at: savedSample.created_at,
            method: data.method,
            duration_ms: duration
        };
    } catch (error: any) {
        console.error('❌ Error crítico al guardar muestra:', error);
        throw error;
    }
}

/**
 * 🔍 VERIFICAR MUESTRA GUARDADA
 * 
 * Verifica que la muestra existe en la base de datos
 */
export async function verifySavedSample(sampleId: string): Promise<boolean> {
    console.log('🔍 Verificando muestra guardada...');
    
    try {
        const { data, error } = await supabase
            .from('audit_historical_samples')
            .select('id')
            .eq('id', sampleId)
            .single();
        
        if (error || !data) {
            console.error('❌ Muestra no encontrada:', error?.message || 'No data');
            return false;
        }
        
        console.log('✅ Muestra verificada exitosamente');
        return true;
    } catch (error) {
        console.error('❌ Error verificando muestra:', error);
        return false;
    }
}

/**
 * 📊 OBTENER ESTADÍSTICAS DE MUESTRAS
 * 
 * Retorna el historial de muestras guardadas para una población
 */
export async function getSaveStatistics(populationId: string) {
    console.log('📊 Obteniendo estadísticas de muestras...');
    
    try {
        const { data, error } = await supabase
            .from('audit_historical_samples')
            .select('id, method, sample_size, created_at, is_final, is_current')
            .eq('population_id', populationId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0, samples: [], lastSaved: null };
        }
        
        console.log(`✅ Estadísticas obtenidas: ${data.length} muestras`);
        
        return {
            total: data.length,
            samples: data,
            lastSaved: data[0]?.created_at || null
        };
    } catch (error) {
        console.error('❌ Error en getSaveStatistics:', error);
        return { total: 0, samples: [], lastSaved: null };
    }
}

export default {
    saveSample,
    verifySavedSample,
    getSaveStatistics
};
