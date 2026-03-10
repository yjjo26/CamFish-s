import { supabase } from '../lib/supabase';
import { Spot, SpotDetail } from '../types/database.types';

// Fetch lightweight spots for the map
export const fetchSpots = async (): Promise<Spot[]> => {
    const { data, error } = await supabase
        .from('spots')
        .select('*');

    if (error) {
        console.error('Error fetching spots:', error);
        return [];
    }
    return data || [];
};

// Fetch detailed properties for a specific spot
export const fetchSpotDetail = async (spotId: string, name?: string): Promise<SpotDetail | null> => {
    // 1. Try by ID first
    const { data, error } = await supabase
        .from('spot_details')
        .select('*')
        .eq('spot_id', spotId)
        .maybeSingle();

    if (error) {
        console.error(`Error fetching detail for spot ${spotId}:`, error);
        return null;
    }

    if (data) return data;

    // 2. Fallback: Try by name if ID was not found and name is provided
    // This is necessary because the spots table contains many duplicate records with the same name but different IDs.
    if (name) {
        console.log(`[DEBUG] No detail found for ID ${spotId}. Falling back to name: ${name}`);

        // Find other spots with the same name to get their IDs
        const { data: siblingSpots } = await supabase
            .from('spots')
            .select('id')
            .eq('name', name);

        if (siblingSpots && siblingSpots.length > 0) {
            const siblingIds = siblingSpots.map(s => s.id);
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('spot_details')
                .select('*')
                .in('spot_id', siblingIds)
                .limit(1)
                .maybeSingle();

            if (!fallbackError && fallbackData) {
                console.log(`[DEBUG] Successfully found detail via name fallback for: ${name}`);
                return fallbackData;
            }
        }
    }

    return null;
};
