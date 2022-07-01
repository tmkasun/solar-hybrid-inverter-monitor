import React from 'react';
import {
    Box,
    keyframes,
    LinearProgress,
    Skeleton,
    Tooltip,
} from '@mui/material';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime, {
    rounding: Math.floor,
});

type SummaryViewProps = {
    lastUpdated: Date;
    isFetching: boolean;
    isModeLoading: boolean;
    data: any;
};

const blinkerAnimation = keyframes`
    50% {
      opacity: 0;
    }
`;

function SummaryView({
    lastUpdated,
    isFetching,
    isModeLoading,
    data
}: SummaryViewProps) {

    return (
        <Box
            display="flex"
            justifyContent="flex-start"
            alignContent="flex-start"
            flexDirection="column"
            sx={{
                alignItems: 'center',
            }}
        >
            <Box display="flex">
                Mode:{' '}
                {isModeLoading ? (
                    <Skeleton variant="rectangular" width={30} />
                ) : (
                    <Tooltip title={data && data.mode}>
                        {/* TODO: tmkasun add standby, Fault, Bypass modes */}
                        {data && data.mode.toLocaleLowerCase() === 'battery' ? (
                            <BatteryChargingFullIcon
                                sx={{
                                    animation: `${blinkerAnimation} 1s linear infinite`,
                                }}
                                color="warning"
                            />
                        ) : (
                            <ElectricalServicesIcon
                                sx={{
                                    color: '#08ff8f',
                                    animation: `${blinkerAnimation} 1s linear infinite`,
                                }}
                            />
                        )}
                    </Tooltip>
                )}
            </Box>
            <Box fontSize={10} display="flex">
                Last updated:{' '}
                {lastUpdated ? (
                    `${dayjs().diff(lastUpdated, 's')} seconds ago`
                ) : (
                    <Skeleton width={40} variant="text" />
                )}
                {isFetching && (
                    <LinearProgress
                        sx={{
                            width: '100%',
                            bottom: 0,
                            position: 'absolute',
                        }}
                        color="secondary"
                    />
                )}
            </Box>
        </Box>
    );
}

export default SummaryView;
