import React, { useEffect, useState } from 'react';
export const minMaxMap: { [key: number]: [number, number] } = {
    0: [200, 260], // GV
    1: [45, 55], // GF
    2: [220, 240], // OV
    3: [45, 55], // OF
    4: [0, 2500], // OVA
    5: [0, 3000], // OPW
    6: [0, 100], // OU
    8: [24.5, 27.5], // BV
    9: [0, 50], // BCC
    10: [0, 50], // PVCC
    11: [0, 45], // PVV
    12: [0, 30], // BCV
    13: [0, 120], // BDV
    14: [0, 1000], // PVPW
};
import { useQuery } from 'react-query';
const API_BASE_PATH =
    'https://c65f16f4-836b-47d2-9c70-538ee54dfd7d-prod.e1-us-east-azure.choreoapis.dev/pvkl/inverter/1.0.0';
export default function useInverterLiveStats() {
    return useQuery(
        'liveStats',
        async () => {
            const response = await fetch(`${API_BASE_PATH}/live`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Unable to fetch data /final.json');
            }
            return await response.json();
        },
        {
            // Refetch the data every second
            refetchInterval: 1000,
        }
    );
}

export function useInverterMode() {
    return useQuery(
        'stats/mode',
        async () => {
            const response = await fetch(`${API_BASE_PATH}/mode`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Unable to fetch data /final.json');
            }
            return await response.json();
        },
        {
            // Refetch the data every second
            refetchInterval: 1000 * 30,
        }
    );
}
