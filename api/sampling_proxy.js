import { createClient } from '@supabase/supabase-js';
import { handlePreflight, setCors } from './_cors.js';
import { requireAdmin } from './_auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    setCors(req, res);
    if (handlePreflight(req, res)) return;

    const { action } = req.query;

    try {
        if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase Config');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // --- GET Actions ---
        if (req.method === 'GET') {
            // Actions independent of population_id
            if (action === 'get_users') {
                const { error: adminErr } = await requireAdmin(req);
                if (adminErr) return res.status(adminErr === 'Forbidden: Admin role required' ? 403 : 401).json({ error: adminErr });

                // Query profiles table directly — contains all fields the frontend needs
                // (full_name, role, is_active, registration_date, etc.) and avoids
                // the auth.admin.listUsers() response format mismatch
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, is_active, registration_date, registration_location, device_info, browser_info')
                    .order('registration_date', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ users: profiles });

            } else if (action === 'get_populations') {
                // FALLBACK: Si no hay SERVICE_ROLE_KEY, usar conexión anon con RLS
                let supabaseClient;

                if (supabaseServiceKey) {
                    // Usar service role si está disponible
                    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
                } else {
                    // Fallback: usar anon key (requiere RLS configurado)
                    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
                    if (!anonKey) throw new Error('No Supabase keys available');
                    supabaseClient = createClient(supabaseUrl, anonKey);
                    console.warn('Using anon key fallback for get_populations');
                }

                const { data, error } = await supabaseClient
                    .from('audit_populations')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('get_populations error:', error);
                    throw error;
                }
                return res.status(200).json({ populations: data });

            } else if (action === 'get_all_results') {
                // Modified to be optional population_id
                const { population_id } = req.query;
                let query = supabase
                    .from('audit_results')
                    .select('results_json, population_id');

                if (population_id) {
                    query = query.eq('population_id', population_id);
                }

                const { data, error } = await query;
                if (error) throw error;
                return res.status(200).json({ results: data });
            }

            // Actions requiring population_id
            const { population_id } = req.query;
            if (!population_id) return res.status(400).json({ error: 'Missing population_id' });

            if (action === 'get_universe') {
                // LIGHT PAYLOAD LOGIC
                // Optimization: Exclude 'risk_factors' (Text Array) by default to prevent Vercel 4.5MB Limit.
                // Only unique_id, value, and risk_score are strictly needed for most algorithms.
                const { detailed, include_factors } = req.query;

                let selectColumns = 'unique_id_col, monetary_value_col, risk_score';

                if (detailed === 'true') {
                    selectColumns += ', risk_factors, raw_json';
                } else if (include_factors === 'true') {
                    selectColumns += ', risk_factors';
                }

                const { data, error } = await supabase
                    .from('audit_data_rows')
                    .select(selectColumns)
                    .eq('population_id', population_id)
                    .limit(20000);
                if (error) throw error;
                return res.status(200).json({ rows: data });

            } else if (action === 'get_smart_sample') {
                // SERVER-SIDE SAMPLING (Risk Based)
                // Returns top N riskiest items directly from DB to avoid browser processing of 20k rows.
                const { sample_size } = req.query; // population_id already declared above
                const limit = parseInt(sample_size) || 30;

                const { data, error } = await supabase
                    .from('audit_data_rows')
                    .select('unique_id_col, monetary_value_col, risk_score, risk_factors, raw_json')
                    .eq('population_id', population_id)
                    .order('risk_score', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                return res.status(200).json({ rows: data });

            } else if (action === 'get_non_statistical_sample') {
                // SERVER-SIDE SAMPLING (Specific Non-Statistical Criteria)
                const { type, size, threshold } = req.query;
                const limit = parseInt(size) || 30;

                let query = supabase.from('audit_data_rows')
                    .select('unique_id_col, monetary_value_col, risk_score, risk_factors, raw_json')
                    .eq('population_id', population_id);

                switch (type) {
                    case 'RiskScoring':
                        query = query.order('risk_score', { ascending: false });
                        break;
                    case 'Benford':
                        // Filter rows where risk_factors array contains Benford alerts
                        // Note: Requires risk_factors to be populated correctly during upload/profiling
                        query = query.not('risk_factors', 'is', null).or('risk_factors.cs.{"Benford"},risk_factors.cs.{"Benford (1)"},risk_factors.cs.{"Benford (2)"}');
                        // Fallback order
                        query = query.order('risk_score', { ascending: false });
                        break;
                    case 'Outliers':
                        // Use threshold if provided (passed from client analysis)
                        if (threshold) {
                            query = query.gt('monetary_value_col', threshold);
                        } else {
                            // Fallback: Just high risk/high value
                            query = query.order('monetary_value_col', { ascending: false });
                        }
                        break;
                    case 'Duplicates':
                        query = query.contains('risk_factors', ['Duplicado']);
                        break;
                    case 'RoundNumbers':
                        // Search for generic Round Number tag
                        query = query.contains('risk_factors', ['Redondo']);
                        break;
                    default:
                        query = query.order('risk_score', { ascending: false });
                }

                const { data, error } = await query.limit(limit);

                if (error) throw error;

                // If specific filter returns few/no results, fallback to Risk Score? 
                // For now return what we found. Client handles empty check.
                return res.status(200).json({ rows: data });

            } else if (action === 'get_history') {
                console.log('📜 get_history called for population_id:', population_id);
                const { data, error } = await supabase
                    .from('audit_historical_samples')
                    .select('*')
                    .eq('population_id', population_id)
                    .order('created_at', { ascending: false });
                if (error) throw error;

                // 🔍 DEBUG: Log what we're returning
                if (data && data.length > 0) {
                    console.log('📜 Found', data.length, 'historical samples');
                    data.forEach((sample, idx) => {
                        console.log(`  Sample ${idx + 1}:`, {
                            id: sample.id,
                            method: sample.method,
                            is_current: sample.is_current,
                            sample_size: sample.sample_size,
                            has_results_snapshot: !!sample.results_snapshot,
                            updated_at: sample.updated_at
                        });
                    });
                }

                return res.status(200).json({ history: data });

            } else if (action === 'get_observations') {
                const { data, error } = await supabase
                    .from('observaciones_auditoria')
                    .select('*')
                    .eq('id_poblacion', population_id)
                    .order('fecha_creacion', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ observations: data });

            } else {
                return res.status(400).json({ error: 'Invalid GET action' });
            }
        }

        // --- POST Actions ---
        else if (req.method === 'POST') {
            if (action === 'create_population') {
                console.log('🚀 create_population called via backend');
                const { population, data_rows, user_id } = req.body;

                if (!population || !data_rows || !user_id) {
                    return res.status(400).json({ error: 'Missing required fields: population, data_rows, user_id' });
                }

                console.log(`Creating population: ${population.audit_name}, rows: ${data_rows.length}`);

                // Insert population
                const { data: popData, error: popError } = await supabase
                    .from('audit_populations')
                    .insert([{ ...population, user_id }])
                    .select()
                    .single();

                if (popError) {
                    console.error('❌ Error creating population:', popError);
                    throw popError;
                }

                const populationId = popData.id;
                console.log(`✅ Population created: ${populationId}`);

                // Insert data rows in batches of 1000
                const BATCH_SIZE = 1000;
                let inserted = 0;

                for (let i = 0; i < data_rows.length; i += BATCH_SIZE) {
                    const batch = data_rows.slice(i, i + BATCH_SIZE).map(row => ({
                        ...row,
                        population_id: populationId
                    }));

                    const { error: rowsError } = await supabase
                        .from('audit_data_rows')
                        .insert(batch);

                    if (rowsError) {
                        console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, rowsError);
                        throw rowsError;
                    }

                    inserted += batch.length;
                    console.log(`✅ Inserted ${inserted}/${data_rows.length} rows`);
                }

                return res.status(200).json({
                    success: true,
                    population_id: populationId,
                    inserted_rows: inserted
                });

            } else if (action === 'save_sample') {
                const { population_id, method, sample_data, is_final } = req.body;
                if (!population_id || !method || !sample_data) return res.status(400).json({ error: 'Missing required fields' });

                // 🔒 RLS: Obtener user_id de la población para asociar la muestra
                const { data: population, error: popError } = await supabase
                    .from('audit_populations')
                    .select('user_id')
                    .eq('id', population_id)
                    .single();

                if (popError) {
                    console.error('Error fetching population user_id:', popError);
                    throw new Error('Population not found or inaccessible');
                }

                if (is_final) {
                    await supabase
                        .from('audit_historical_samples')
                        .update({ is_current: false })
                        .eq('population_id', population_id)
                        .eq('is_current', true);
                }

                const payload = {
                    population_id,
                    method,
                    user_id: population?.user_id, // 🔒 RLS: Incluir user_id
                    objective: sample_data.objective,
                    seed: sample_data.seed,
                    sample_size: sample_data.sample_size,
                    params_snapshot: sample_data.params_snapshot,
                    results_snapshot: sample_data.results_snapshot,
                    is_final: !!is_final,
                    is_current: !!is_final
                };

                const { data, error } = await supabase
                    .from('audit_historical_samples')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                return res.status(200).json(data);

            } else if (action === 'save_work_in_progress') {
                console.log('📝 save_work_in_progress called');
                const { population_id, results_json, sample_size } = req.body;
                console.log('Population ID:', population_id);
                console.log('Results JSON type:', typeof results_json);
                console.log('Sample size:', sample_size);

                if (!population_id || !results_json) {
                    console.error('Missing fields - population_id:', !!population_id, 'results_json:', !!results_json);
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                try {
                    // 🔒 RLS: Obtener user_id de la población
                    const { data: population, error: popError } = await supabase
                        .from('audit_populations')
                        .select('user_id')
                        .eq('id', population_id)
                        .single();

                    if (popError) {
                        console.error('Error fetching population user_id:', popError);
                        throw new Error('Population not found or inaccessible');
                    }

                    const { data, error } = await supabase
                        .from('audit_results')
                        .upsert({
                            population_id,
                            user_id: population?.user_id, // 🔒 RLS: Incluir user_id
                            results_json,
                            sample_size,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'population_id' })
                        .select();

                    if (error) {
                        console.error('Supabase upsert error:', error);
                        throw error;
                    }

                    console.log('✅ Save successful');
                    return res.status(200).json(data);
                } catch (upsertError) {
                    console.error('Upsert exception:', upsertError);
                    throw upsertError;
                }


            } else if (action === 'update_current_sample') {
                console.log('🔄 update_current_sample called');
                const { population_id, method, results_json } = req.body;
                console.log('Population ID:', population_id);
                console.log('Method:', method);
                console.log('Results JSON type:', typeof results_json);

                if (!population_id || !method || !results_json) {
                    console.error('Missing fields - population_id:', !!population_id, 'method:', !!method, 'results_json:', !!results_json);
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                try {
                    // ✅ CRITICAL: Filter by population_id + is_current=true + method
                    // This ensures we ONLY update the active sample for THIS specific method
                    const { data, error } = await supabase
                        .from('audit_historical_samples')
                        .update({
                            results_snapshot: results_json,
                            updated_at: new Date().toISOString()
                        })
                        .eq('population_id', population_id)
                        .eq('is_current', true)
                        .eq('method', method)
                        .select();

                    if (error) {
                        console.error('Supabase update error:', error);
                        throw error;
                    }

                    if (!data || data.length === 0) {
                        // No current sample found - this is OK, just means user hasn't locked yet
                        console.log('ℹ️ No current sample found (user hasn\'t locked sample yet)');
                        return res.status(200).json({ updated: false, reason: 'no_current_sample' });
                    }

                    console.log(`✅ Updated current sample for method ${method}`);
                    return res.status(200).json({ updated: true, data });
                } catch (updateError) {
                    console.error('Update exception:', updateError);
                    throw updateError;
                }


            } else if (action === 'delete_population') {
                const { population_id } = req.body;
                if (!population_id) return res.status(400).json({ error: 'Missing population_id' });
                const { error } = await supabase.from('audit_populations').delete().eq('id', population_id);
                if (error) throw error;
                return res.status(200).json({ success: true });

            } else if (action === 'create_user') {
                const { error: adminErr } = await requireAdmin(req);
                if (adminErr) return res.status(adminErr === 'Forbidden: Admin role required' ? 403 : 401).json({ error: adminErr });

                const { full_name, email, password, role } = req.body;
                if (!full_name || !email || !password || !role) return res.status(400).json({ error: 'Missing required fields' });

                // Create user via admin API — email pre-confirmed, temp password, force change flag
                const { data: { user: newUser }, error: createErr } = await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name, role, must_change_password: true }
                });
                if (createErr) throw createErr;

                // Upsert profile so it's immediately visible and active (admin-created users don't need approval)
                await supabase.from('profiles').upsert({
                    id: newUser.id,
                    full_name,
                    role,
                    is_active: true,
                    registration_date: new Date().toISOString()
                }, { onConflict: 'id' });

                return res.status(200).json({ success: true, user_id: newUser.id });

            } else if (action === 'delete_user') {
                const { error: adminErr } = await requireAdmin(req);
                if (adminErr) return res.status(adminErr === 'Forbidden: Admin role required' ? 403 : 401).json({ error: adminErr });

                const { user_id } = req.body;
                if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

                // Delete from auth.users — cascades to profiles via FK or trigger
                const { error: deleteErr } = await supabase.auth.admin.deleteUser(user_id);
                if (deleteErr) throw deleteErr;

                // Explicit cleanup of profiles row in case there's no cascade
                await supabase.from('profiles').delete().eq('id', user_id);

                return res.status(200).json({ success: true });

            } else if (action === 'toggle_user_status') {
                const { user_id, status } = req.body;
                if (!user_id || typeof status === 'undefined') return res.status(400).json({ error: 'Missing args' });
                const { data, error } = await supabase.from('profiles').update({ is_active: status }).eq('id', user_id).select();
                if (error) throw error;
                return res.status(200).json({ data });

            } else if (action === 'sync_chunk') {
                const { rows } = req.body;
                if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'Invalid rows' });
                const { data, error } = await supabase.from('audit_data_rows').insert(rows).select('id');
                if (error) throw error;
                return res.status(200).json({ success: true, count: rows.length });

            } else if (action === 'save_observation') {
                const { id, ...payload } = req.body;
                let error;
                if (id) {
                    const { error: err } = await supabase.from('observaciones_auditoria').update(payload).eq('id', id);
                    error = err;
                } else {
                    const { error: err } = await supabase.from('observaciones_auditoria').insert(payload);
                    error = err;
                }
                if (error) throw error;
                return res.status(200).json({ success: true });

            } else if (action === 'delete_observation') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: 'Missing id' });
                const { error } = await supabase.from('observaciones_auditoria').delete().eq('id', id);
                if (error) throw error;
                return res.status(200).json({ success: true });

            } else if (action === 'get_rows_batch') {
                const { population_id, ids } = req.body;
                if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });
                const { data, error } = await supabase
                    .from('audit_data_rows')
                    // Now including risk_factors in hydration since we excluded it from universe
                    .select('unique_id_col, raw_json, risk_factors')
                    .eq('population_id', population_id)
                    .in('unique_id_col', ids);
                if (error) throw error;
                return res.status(200).json({ rows: data });

            } else if (action === 'calculate_sample') {
                // UNIVERSAL SERVER-SIDE SAMPLING ENGIN
                const { population_id, method, params } = req.body;
                if (!population_id || !method) return res.status(400).json({ error: 'Missing args' });

                let query = supabase
                    .from('audit_data_rows')
                    .select('unique_id_col, monetary_value_col, risk_score, risk_factors, raw_json')
                    .eq('population_id', population_id);

                const limit = parseInt(params?.sampleSize) || 30;

                if (method === 'NonStatistical') {
                    const insight = params?.insight;
                    if (insight === 'RiskScoring') {
                        query = query.order('risk_score', { ascending: false });
                    } else if (insight === 'Materiality' || insight === 'Outliers') {
                        query = query.order('monetary_value_col', { ascending: false });
                    } else {
                        // Random / Manual / Default
                        // Note: Postgres random() is not directly exposed in Supabase JS easily without RPC, 
                        // but we can use a trick or just fetch a slightly larger batch and shuffle in Node if needed.
                        // For simplicity in this proxy, we'll try no order which implies insertion/random-ish or use a known column.
                        // Ideally: query.order('random()') -> Not valid in JS client. 
                        // Workaround: RPC or just fetch and shuffle. 
                        // Given 20k rows constraint, we'll use a random offset implementation if possible, 
                        // BUT for robustness now: we fetch limit * 2 ordered by uuid (pseudo random)
                        // Actually, 'unique_id_col' is text. 
                        // To allow true random server side without RPC 'random_sample', we might need to rely on 'get_smart_sample' logic extended.
                        // Let's use a simple heuristic: Order by unique_id_col (Arbitrary) serves as "Systematic/Random" for now.
                        // User wants NO FREEZE.
                    }
                } else if (method === 'Attribute') {
                    // Random Selection
                    // heuristic: order by unique_id_col (Detailed Randomness not needed for Attribute usually, just Selection)
                    query = query.order('unique_id_col', { ascending: true });
                }

                // EXECUTE QUERY
                const { data, error } = await query.limit(limit);

                if (error) throw error;
                return res.status(200).json({ rows: data });

            } else if (action === 'expand_sample') {
                // SERVER-SIDE SAMPLE EXPANSION (Prevent Browser Freeze)
                const { population_id, existing_ids, amount } = JSON.parse(body);

                if (!population_id || !existing_ids || !amount) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // Query for additional rows NOT in existing sample, ordered by risk_score descending
                const { data, error } = await supabase
                    .from('audit_data_rows')
                    .select('unique_id_col, monetary_value_col, risk_score, risk_factors, raw_json')
                    .eq('population_id', population_id)
                    .not('unique_id_col', 'in', `(${existing_ids.map(id => `"${id}"`).join(',')})`)
                    .order('risk_score', { ascending: false })
                    .limit(parseInt(amount) || 15);

                if (error) throw error;
                return res.status(200).json({ rows: data });

            } else {
                return res.status(400).json({ error: 'Invalid POST action' });
            }
        }

        else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('[Sampling Proxy Error]', error);
        return res.status(500).json({ error: error.message });
    }
}
