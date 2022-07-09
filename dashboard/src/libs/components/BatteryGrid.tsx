import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import React from 'react';
import Gauge from '../Gauge';
import { minMaxMap } from '../hooks/inverterStats';
import PowerIcon from '@mui/icons-material/Power';
import SolarPowerIcon from '@mui/icons-material/SolarPower';
import { keyframes, useTheme } from '@mui/material';
import { blinkerAnimation } from './SummaryView';

type devStatus = {
    name: string;
    value: string;
};
type BatteryGridProps = {
    batVValue: string;
    bccValue: string;
    bcValue: string;
    batDIValue: string;
    bcc: string;
    batV: string;
    bc: string;
    batDI: string;
    parameters: Array<
        | [string, string]
        | [
              string,
              {
                  conof: devStatus;
                  acconof: devStatus;
                  ls: devStatus;
                  sccconof: devStatus;
              }
          ]
    >;
};

function BatteryGrid({
    batVValue,
    bccValue,
    bcValue,
    batDIValue,
    bcc,
    batV,
    bc,
    batDI,
    parameters,
}: BatteryGridProps) {
    let isCharging, isPVCharging, isACCharging;
    const [, deviceStatusValue] = parameters.at(16) || [];
    if (deviceStatusValue && typeof deviceStatusValue !== 'string') {
        isCharging = deviceStatusValue.conof.value === '1';
        isACCharging = deviceStatusValue.acconof.value === '1' && isCharging;
        isPVCharging = deviceStatusValue.sccconof.value === '1' && isCharging;
    }
    const theme = useTheme();
    return (
        <Paper elevation={7}>
            Battery
            <Box
                sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 2,
                    justifyContent: 'space-around',
                }}
            >
                <Box>Charging: {isCharging ? 'yes' : 'no'}</Box>
                <Box>
                    PV:{' '}
                    <Chip
                        icon={<SolarPowerIcon />}
                        color={isPVCharging ? 'success' : 'default'}
                        label={isPVCharging ? 'Charging' : 'Not Charging'}
                        disabled={!isPVCharging}
                        sx={{
                            animation: isPVCharging
                                ? `${blinkerAnimation} 2s linear infinite`
                                : 'none',
                        }}
                    />
                </Box>
                <Box>
                    AC:{' '}
                    <Chip
                        icon={<PowerIcon />}
                        color={isACCharging ? 'success' : 'default'}
                        label={isACCharging ? 'Charging' : 'Not Charging'}
                        disabled={!isACCharging}
                        sx={{
                            animation: isACCharging
                                ? `${blinkerAnimation} 2s linear infinite`
                                : 'none',
                        }}
                    />
                </Box>
            </Box>
            <Box
                flexWrap="wrap"
                display="flex"
                justifyContent="space-around"
                alignItems="center"
                flexDirection="row"
            >
                <Gauge
                    minMax={minMaxMap[8]}
                    value={Number(batVValue)}
                    name={batV}
                    unit="V"
                />
                <Gauge
                    minMax={minMaxMap[15]}
                    value={Number(batDIValue)}
                    name={batDI}
                />
                <Gauge
                    minMax={minMaxMap[9]}
                    value={Number(bccValue)}
                    name={bcc}
                />

                <Gauge
                    minMax={minMaxMap[10]}
                    value={Number(bcValue)}
                    name={bc}
                />
            </Box>
        </Paper>
    );
}

export default BatteryGrid;
