import {
    Alert,
    Box,
    CircularProgress,
    Grid,
    Paper,
    Skeleton,
} from '@mui/material';
import React from 'react';
import Gauge from '../Gauge';
import { minMaxMap } from '../hooks/inverterStats';
import BatteryGrid from './BatteryGrid';
import TemperatureGauge from './TemperatureGauge';

type GridViewProps = {
    isLoading: boolean;
    data: { [key: string]: string };
};

function GridView({ isLoading, data }: GridViewProps) {
    if (isLoading) {
        return (
            <>
                <Grid item xs={12} sm={6} md={4}>
                    <Box
                        mt={2}
                        display="flex"
                        sx={{ justifyContent: 'center' }}
                    >
                        <CircularProgress />
                    </Box>
                </Grid>
            </>
        );
    }
    if (!isLoading && !data) {
        return (
            <Grid item xs={12} sm={6} md={4}>
                <Box mt={2} display="flex" sx={{ justifyContent: 'center' }}>
                    <Alert severity="error">No data found</Alert>
                </Box>
            </Grid>
        );
    }
    let parameters = Object.entries(data);
    if (parameters.length !== 20) {
        parameters = new Array(20).fill(null).map(() => ["", ""])
    }
    const [
        [gv, gvValue], // 0
        [gf, gfValue], // 1
        [ov, ovValue], // 2
        [of, ofValue], // 3
        [oVA, oVAValue], // 4
        [oW, oWValue], // 5
        [ol, olValue], // 6
        [bv, bvValue], // 7
        [batV, batVValue], // 8
        [bcc, bccValue], // 9
        [bc, bcValue], // 10
        [itemp, itempValue], // 11
        [icc4b, icc4bValue], // 12
        [pvv, pvvValue], // 13
        [batVSCC, batVSCCValue], // 14
        [batDI, batDIValue], // 15
        [deviceStatus, deviceStatusValue], // 16
        [fvov, fvovValue], // 17
        [eepromV, eepromVValue], // 18
        [pvp, pvpValue], // 19
    ] = parameters;
    const batteryProps = {
        batVValue,
        bccValue,
        bcValue,
        batDIValue,
        bcc,
        batV,
        bc,
        batDI,
    };
    return (
        <Grid
            container
            direction="column"
            justifyContent="center"
            alignItems="center"
            spacing={4}
        >
            <Grid
                item
                container
                direction="row"
                justifyContent="center"
                alignItems="center"
            >
                <Grid item xs={12} md={7}>
                    <Paper elevation={7}>
                        PV
                        <Box
                            display="flex"
                            flexWrap="wrap"
                            justifyContent="space-around"
                            flexDirection="row"
                        >
                            <Gauge
                                minMax={minMaxMap[19]}
                                value={Number(pvpValue)}
                                name={pvp}
                                unit="W"
                            />
                            <Gauge
                                minMax={minMaxMap[13]}
                                value={Number(pvvValue)}
                                name={pvv}
                            />
                            <Gauge
                                minMax={minMaxMap[12]}
                                value={Number(icc4bValue)}
                                name={icc4b}
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
            <Grid
                item
                container
                direction="row"
                justifyContent="center"
                alignItems="stretch"
                spacing={3}
            >
                <Grid item xs={12} md={5}>
                    <Paper
                        sx={{
                            height: '100%',
                        }}
                        elevation={7}
                    >
                        Utility
                        <Box
                            display="flex"
                            flexDirection="row"
                            justifyContent="center"
                            alignItems="center"
                            flexWrap="wrap"
                        >
                            <Gauge
                                minMax={minMaxMap[0]}
                                value={Number(gvValue)}
                                name={gv}
                            />
                            <Gauge
                                minMax={minMaxMap[1]}
                                value={Number(gfValue)}
                                name={gf}
                            />
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={7}>
                    <Paper elevation={7}>
                        Output
                        <Box
                            flexWrap="wrap"
                            display="flex"
                            justifyContent="space-around"
                            alignItems="center"
                            flexDirection="row"
                        >
                            <Gauge
                                minMax={minMaxMap[2]}
                                value={Number(ovValue)}
                                name={ov}
                            />
                            <Gauge
                                minMax={minMaxMap[5]}
                                value={Number(oWValue)}
                                name={oW}
                            />
                            <Gauge
                                minMax={minMaxMap[6]}
                                value={Number(olValue)}
                                name={ol}
                            />
                            <Gauge
                                minMax={minMaxMap[3]}
                                value={Number(ofValue)}
                                name={of}
                            />
                            <Gauge
                                minMax={minMaxMap[4]}
                                value={Number(oVAValue)}
                                name={oVA}
                            />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
            <Grid
                item
                container
                direction="row"
                justifyContent="center"
                alignItems="center"
            >
                <Grid item xs={12} md={8}>
                    <BatteryGrid parameters={parameters} {...batteryProps} />
                </Grid>
            </Grid>
        </Grid>
    );
}

export default GridView;

/** 
 * 
 * 
 * 
    data &&
                  Object.entries(data).map(([name, value], index) => {
                      const parameter = Number(value);
                      return Number.isNaN(parameter) ? null : (
                          <Grid key={name} item xs={12} sm={6} md={2}>
                              <Box
                                  mt={2}
                                  display="flex"
                                  sx={{ justifyContent: 'center' }}
                              >
                                  {index === 11 ? (
                                      <TemperatureGauge
                                          name={name}
                                          value={value}
                                      />
                                  ) : (
                                      <Gauge
                                          minMax={minMaxMap[index]}
                                          id={name}
                                          value={Number(value)}
                                          name={`${index}:${name}`}
                                      />
                                  )}
                              </Box>
                          </Grid>
                      );
                  })
*/
