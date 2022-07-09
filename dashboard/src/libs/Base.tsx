import React, { JSXElementConstructor, ReactElement } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import DiagramVsGauges from './components/DiagramVsGauges';
import SummaryView from './components/SummaryView';
import { useInverterMode } from './hooks/inverterStats';
import ErrorsAndSettings from './components/ErrorsAndSettings';

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
                        backgroundColor:
                            data && data.mode.toLocaleLowerCase() === 'battery'
                                ? 'orange'
                                : '#0071adbd',
                    }}
                >
                    <Toolbar>
                        <Typography sx={{ flexGrow: 1 }} variant="h6">
                            Inverter Stats
                        </Typography>
                        <ErrorsAndSettings />
                        <DiagramVsGauges />
                        <SummaryView
                            isModeLoading={isModeLoading}
                            data={data}
                            lastUpdated={lastUpdated}
                            isFetching={isFetching}
                        />
                    </Toolbar>
                </AppBar>
            </ElevationScroll>
            <Toolbar />
            <Box>{children}</Box>
            <Box color="text.secondary">
                Copyright 2022{' '}
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
