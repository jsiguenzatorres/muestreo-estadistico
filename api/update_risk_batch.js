
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase configuration:', { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { updates } = req.body;

        if (!updates || !Array.isArray(updates)) {
            console.error('Invalid payload:', { updates: typeof updates, isArray: Array.isArray(updates) });
            return res.status(400).json({ error: 'Invalid updates payload - must be array' });
        }

        if (updates.length === 0) {
            return res.status(200).json({ success: true, count: 0, message: 'No updates to process' });
        }

        console.log(`Processing ${updates.length} risk updates...`);

        // Validar estructura de cada update
        const invalidUpdates = updates.filter(update => !update.id || typeof update.id !== 'string');
        if (invalidUpdates.length > 0) {
            console.error('Invalid update structure:', invalidUpdates.slice(0, 3));
            return res.status(400).json({
                error: 'Invalid update structure - missing id field',
                sample: invalidUpdates.slice(0, 3)
            });
        }

        // Batch upsert in smaller chunks to avoid timeout and memory issues
        const CHUNK_SIZE = 50; // Reducido de 100 a 50 para mejor estabilidad
        const errors = [];
        let processedCount = 0;

        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);

            try {
                console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(updates.length / CHUNK_SIZE)} (${chunk.length} items)`);

                // Mapear de vuelta a la estructura de la tabla usando unique_id_col
                const mappedChunk = chunk.map(item => ({
                    unique_id_col: item.id,      // 'id' viene del frontend, pero la columna se llama unique_id_col
                    risk_score: item.risk_score,
                    risk_factors: item.risk_factors
                }));

                const { error, count } = await supabase
                    .from('audit_data_rows')
                    .upsert(mappedChunk, {
                        onConflict: 'unique_id_col',  // PK real de la tabla
                        count: 'exact'
                    });

                if (error) {
                    console.error('Batch upsert error:', error);
                    errors.push({
                        chunk: Math.floor(i / CHUNK_SIZE) + 1,
                        error: error.message,
                        details: error.details
                    });
                } else {
                    processedCount += count || chunk.length;
                    console.log(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} processed successfully: ${count || chunk.length} rows`);
                }
            } catch (chunkError) {
                console.error('Chunk processing error:', chunkError);
                errors.push({
                    chunk: Math.floor(i / CHUNK_SIZE) + 1,
                    error: chunkError.message
                });
            }

            // Pausa pequeña entre chunks para evitar rate limiting
            if (i + CHUNK_SIZE < updates.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (errors.length > 0) {
            console.error('Processing completed with errors:', errors);
            return res.status(207).json({
                success: false,
                error: 'Partial processing error',
                details: errors,
                processedCount,
                totalCount: updates.length
            });
        }

        console.log(`Successfully processed ${processedCount} risk updates`);
        return res.status(200).json({
            success: true,
            count: processedCount,
            totalChunks: Math.ceil(updates.length / CHUNK_SIZE)
        });

    } catch (error) {
        console.error('[Update Risk Batch Error]', error);
        return res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
