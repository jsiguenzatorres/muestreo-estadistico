import { supabase } from './supabaseClient';
import { AuditObservation } from '../types';

export const observationService = {
    async getObservations(populationId: string): Promise<AuditObservation[]> {
        const { data, error } = await supabase
            .from('observaciones_auditoria')
            .select('*')
            .eq('id_poblacion', populationId)
            .order('fecha_hallazgo', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async updateReviewComments(observationId: string, comments: any[]): Promise<void> {
        const { error } = await supabase
            .from('observaciones_auditoria')
            .update({ review_comments: comments })
            .eq('id', observationId);

        if (error) throw error;
    }
};
