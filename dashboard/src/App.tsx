import React, { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import Gauge from './libs/Gauge';
import Base from './libs/Base';
import './styles.css';
import useInverterLiveStats, { minMaxMap } from './libs/hooks/useInverterLiveStats';

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
    const [dataType, setDataType] = useState('total');
    const [lastXDays, setLastXDays] = useState(0);
    const { isLoading, data, isError, error } = useInverterLiveStats();

    return (
        <Base
            setLastXDays={setLastXDays}
            lastXDays={lastXDays}
            isLoading={false}
            dataType={dataType}
            setDataType={setDataType}
        >
            <Grid
                container
                direction="row"
                justifyContent="center"
                alignItems="flex-start"
            >
                {isLoading
                    ? 'Loading . . . '
                    : data &&
                      Object.entries(data).map(([name, value], index) => {
                          const parameter = Number(value);
                          return Number.isNaN(parameter) ? null : (
                              <Grid key={name} item sm={3}>
                                  <Gauge
                                      minMax={minMaxMap[index]}
                                      id={name}
                                      value={Number(value)}
                                      name={`${index}:${name}`}
                                  />
                              </Grid>
                          );
                      })}
            </Grid>
        </Base>
    );
};

export default App;
