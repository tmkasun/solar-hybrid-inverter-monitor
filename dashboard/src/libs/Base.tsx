import React, { JSXElementConstructor, ReactElement } from 'react';
import PropTypes from 'prop-types';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';
import Link from '@mui/material/Link';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';

import { useInverterMode } from './hooks/inverterStats';
import { keyframes, LinearProgress, Skeleton, Tooltip } from '@mui/material';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime, {
    rounding: Math.floor,
});
function ElevationScroll(props: {
    children: ReactElement<any, string | JSXElementConstructor<any>>;
}) {
    const { children } = props;
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0,
    });
    return React.cloneElement(children, {
        elevation: trigger ? 2 : 0,
    });
}

const blinkerAnimation = keyframes`
    50% {
      opacity: 0;
    }
`;

export default function HideAppBar(props: any) {
    const { children, isFetching, lastUpdated } = props;
    const { data, isLoading: isModeLoading, isError } = useInverterMode();
    return (
        <>
            <CssBaseline />
            <ElevationScroll>
                <AppBar
                    position="fixed"
                    sx={{
                        backdropFilter: 'blur(4px)',
                        backgroundColor: '#0071adbd',
                    }}
                >
                    <Toolbar>
                        <Typography sx={{ flexGrow: 1 }} variant="h6">
                            Inverter Stats
                        </Typography>
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
                                    <Skeleton
                                        variant="rectangular"
                                        width={30}
                                    />
                                ) : (
                                    <Tooltip title={data && data.mode}>
                                        {data &&
                                        data.mode.toLocaleLowerCase() ===
                                            'battery' ? (
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
                                    `${dayjs().diff(
                                        lastUpdated,
                                        's'
                                    )} seconds ago`
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
                    </Toolbar>
                </AppBar>
            </ElevationScroll>
            <Toolbar />
            <Box>{children}</Box>
            <Box color="text.secondary">
                Copyright 2022 {' '}
                <Link
                    target="_blank"
                    rel="noopener"
                    href={'https://me.knnect.com'}
                >
                    Knnect
                </Link>
            </Box>
        </>
    );
}
