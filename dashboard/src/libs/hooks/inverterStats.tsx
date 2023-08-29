import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';

import { API_BASE_PATH } from '../components/consts';

export const minMaxMap: { [key: number]: [number, number] } = {
    0: [210, 250], // GV
    1: [48.5, 51.5], // GF
    2: [215, 245], // OV
    3: [48.5, 51.5], // OF
    4: [0, 2500], // OVA
    5: [0, 2700], // OPW
    6: [0, 100], // OL
    7: [0, 500], // BUS voltage
    8: [25.5, 27.0], // BV // Nominal is 24.5 to 27.5
    9: [0, 50], // BCC
    10: [0, 100], // BatteryCap
    11: [0, 45], // Heat sink temp
    12: [0, 30], // ICB
    13: [0, 50], // PV Voltage
    14: [24, 27.5], // BatteryV from SCC
    15: [0, 120], // Battery Discharge I
    16: [0, 1000], // Stats
    17: [0, 1000], // Battery fan offset I
    18: [0, 5], // EEPROM Version
    19: [0, 1000], // PV Power
};

export default function useInverterLiveStats() {
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [reFetchInt, setReFetchInt] = useState(1000);
    const queryData = useQuery(
        'liveStats',
        async () => {
            const response = await fetch(`${API_BASE_PATH}/stats/live`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Unable to fetch Inverter Stats');
            }
            setLastUpdated(new Date());
            return await response.json();
        },
        {
            // Refetch the data every second
            refetchInterval: reFetchInt,
            onError: () => setReFetchInt(0),
        }
    );
    return { ...queryData, lastUpdated };
}

export function useInverterMode() {
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [reFetchInt, setReFetchInt] = useState(1000);

    const queryData = useQuery(
        'stats/mode',
        async () => {
            const response = await fetch(`${API_BASE_PATH}/stats/mode`, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Unable to fetch Inverter Mode');
            }
            setLastUpdated(new Date());
            return await response.json();
        },
        {
            // Refetch the data every second
            refetchInterval: reFetchInt,
            onError: () => setReFetchInt(0),
        }
    );
    return { ...queryData, lastUpdated };
}
