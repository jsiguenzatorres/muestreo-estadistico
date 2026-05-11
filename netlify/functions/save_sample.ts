/**
 * 🌐 EDGE FUNCTION: SAVE SAMPLE (OPCIÓN 2 - FALLBACK DE SEGURIDAD)
 * 
 * Esta función actúa como capa de seguridad adicional para el guardado de muestras.
 * Se usa como fallback cuando el guardado directo falla.
 * 
 * DESPLIEGUE:
 * 1. Copiar este archivo a: supabase/functions/save_sample/index.ts
 * 2. Ejecutar: supabase functions deploy save_sample
 * 3. Configurar variables de entorno en Supabase Dashboard
 * 
 * VENTAJAS:
 * - Lógica server-side (más segura)
 * - No expone service role key en cliente
 * - Validaciones adicionales
 * - Rate limiting posible
 * 
 * NOTA: Esta función es OPCIONAL. El sistema funciona sin ella usando guardado directo.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SaveSampleRequest {
    population_id: string;
    method: string;
    sample_data: {
        population_id: string;
        method: string;
        objective: string;
        seed: number;
        sample_size: number;
        params_snapshot: any;
        results_snapshot: any;
        is_final: boolean;
        is_current: boolean;
    };
    is_final: boolean;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('🌐 Edge Function: save_sample iniciada');
        
        // Crear cliente Supabase con service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        // Parsear request
        const requestData: SaveSampleRequest = await req.json();
        console.log('📝 Datos recibidos:', {
            population_id: requestData.population_id,
            method: requestData.method,
            sample_size: requestData.sample_data.sample_size
        });

        // Validaciones server-side
        if (!requestData.sample_data.population_id) {
            throw new Error('population_id es requerido');
        }
        
        if (!requestData.sample_data.method) {
            throw new Error('method es requerido');
        }
        
        if (!requestData.sample_data.sample_size || requestData.sample_data.sample_size <= 0) {
            throw new Error('sample_size debe ser mayor a 0');
        }

        // Guardar en base de datos
        console.log('💾 Guardando en base de datos...');
        const { data: savedSample, error: saveError } = await supabase
            .from('audit_historical_samples')
            .insert({
                population_id: requestData.sample_data.population_id,
                method: requestData.sample_data.method,
                objective: requestData.sample_data.objective,
                seed: requestData.sample_data.seed,
                sample_size: requestData.sample_data.sample_size,
                params_snapshot: requestData.sample_data.params_snapshot,
                results_snapshot: requestData.sample_data.results_snapshot,
                is_final: requestData.sample_data.is_final,
                is_current: requestData.sample_data.is_current
            })
            .select('id, created_at')
            .single();

        if (saveError) {
            console.error('❌ Error al guardar:', saveError);
            throw saveError;
        }

        console.log('✅ Muestra guardada exitosamente:', savedSample.id);

        // Respuesta exitosa
        return new Response(
            JSON.stringify({
                success: true,
                id: savedSample.id,
                created_at: savedSample.created_at,
                message: 'Muestra guardada exitosamente vía Edge Function'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error) {
        console.error('❌ Error en Edge Function:', error);
        
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Error desconocido',
                details: error.toString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        );
    }
});
