import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { API_BASE_PATH } from '../components/consts';

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
