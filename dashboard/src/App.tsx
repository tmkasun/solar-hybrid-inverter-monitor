import React, { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import Gauge from './libs/Gauge';
import Base from './libs/Base';
import './styles.css';
import useInverterLiveStats, { minMaxMap } from './libs/hooks/inverterStats';
import { Skeleton } from '@mui/material';
import PageError from './libs/components/Error';
import TemperatureGauge from './libs/components/TemperatureGauge';
import GridView from './libs/components/GridView';
import DiagramView from './libs/components/DiagramView';
import AppViewsProvider from './data/hooks/AppView';
import { AppViews } from './libs/components/consts';

const SectionSeperator = () => (
    <Grid item sm={12}>
        <Box boxShadow={3} my={2}>
            <Divider />
        </Box>
    </Grid>
);

const App = () => {
    const { isLoading, data, isError, error, lastUpdated, isFetching } =
        useInverterLiveStats();
    const [view, setView] = React.useState<AppViews>(AppViews.Grid);

    return (
        <AppViewsProvider value={{ currentView: view, setView }}>
            <Base isFetching={isFetching} lastUpdated={lastUpdated}>
                <PageError open={isError} error={error} />
                {view === AppViews.Grid && (
                    <GridView isLoading={isLoading} data={data} />
                )}
                {view === AppViews.Diagram && data && <DiagramView />}
            </Base>
        </AppViewsProvider>
    );
};

export default App;
