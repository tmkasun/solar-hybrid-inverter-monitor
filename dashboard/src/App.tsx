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

const SectionSeperator = () => (
    <Grid item sm={12}>
        <Box boxShadow={3} my={2}>
            <Divider />
        </Box>
    </Grid>
);
/**
 *
 * https://echarts.apache.org/examples/en/editor.html?c=pie-simple
 *
 * curl   -H "Accept: application/vnd.github.v3+json"   https://api.github.com/repos/nuuuwan/covid19/contents/?ref=data -o response.json
 *
 * testing
 *
 * curl   -H "Accept: application/json"   https://raw.githubusercontent.com/nuuuwan/covid19/data/covid19.epid.vaxs.20210129.json -o response.json
 *
 * http://www.epid.gov.lk/web/index.php?option=com_content&view=article&id=225&lang=en
 */

const App = () => {
    const { isLoading, data, isError, error, lastUpdated, isFetching } =
        useInverterLiveStats();

    return (
        <Base isFetching={isFetching} lastUpdated={lastUpdated}>
            <Grid
                container
                direction="row"
                justifyContent="center"
                alignItems="center"
            >
                {isLoading
                    ? [1, 2, 3, 4].map((placeHolder) => (
                          <Grid item xs={12} sm={6} md={3}>
                              <Box
                                  mt={2}
                                  display="flex"
                                  sx={{ justifyContent: 'center' }}
                              >
                                  <Skeleton
                                      variant="circular"
                                      width={240}
                                      height={240}
                                  />
                              </Box>
                          </Grid>
                      ))
                    : data &&
                      Object.entries(data).map(([name, value], index) => {
                          const parameter = Number(value);
                          return Number.isNaN(parameter) ? null : (
                              <Grid key={name} item xs={12} sm={6} md={3}>
                                  <Box
                                      mt={2}
                                      display="flex"
                                      sx={{ justifyContent: 'center' }}
                                  >
                                      <Gauge
                                          minMax={minMaxMap[index]}
                                          id={name}
                                          value={Number(value)}
                                          name={name}
                                      />
                                  </Box>
                              </Grid>
                          );
                      })}
            </Grid>
        </Base>
    );
};

export default App;
