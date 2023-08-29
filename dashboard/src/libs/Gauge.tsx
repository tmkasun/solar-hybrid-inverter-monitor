import { useEffect, useLayoutEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import { TitleComponent, TooltipComponent } from 'echarts/components';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { styled } from '@mui/material';
import Box from '@mui/system/Box';

const StyledEChartRoot = styled('div')({
    width: '400px',
    height: '400px',
    display: 'flex',
});
export const defaultOptions: EChartsOption = {
    tooltip: {
        formatter: '{a} <br/>{b} : {c}%',
    },
    series: [
        {
            name: 'Pressure',
            type: 'gauge',
            progress: {
                show: true,
            },
            detail: {
                valueAnimation: true,
                formatter: '{value}',
            },
            data: [
                {
                    value: 50,
                    name: 'SCORE',
                },
            ],
        },
    ],
};


export enum colorOrder {
    'DEC',
    'MED',
    'ACS'
}

const GAUGE_COLORS: { [key in colorOrder]: [number, string][] } = {
    [colorOrder.DEC]: [
        [0.25, '#FF6E76'], // Red
        [0.5, '#FDDD60'], // Yellow 
        [0.75, '#58D9F9'], // Blue
        [1, '#7CFFB2'], // Green 
    ],
    [colorOrder.MED]: [
        [0.1, '#FF6E76'], // Red
        [0.45, '#FDDD60'], // Yellow 
        [0.55, '#7CFFB2'], // Green 
        [0.9, '#FDDD60'], // Yellow
        [1, '#FF6E76'], // Red 
    ], [colorOrder.ACS]: [
        [0.25, '#7CFFB2'], // Green 
        [0.5, '#58D9F9'], // Blue
        [0.75, '#FDDD60'], // Yellow 
        [1, '#FF6E76'], // Red
    ]
}
echarts.use([TitleComponent, GaugeChart, CanvasRenderer, TooltipComponent]);
type InverterGaugeChartProps = {
    value: number;
    name: string;
    id?: string;
    minMax: [number, number];
    unit?: string;
    colorOrdering?: colorOrder;
};
const EnergyLineChart = (props: InverterGaugeChartProps) => {
    const chartRefInst = useRef<HTMLDivElement | null>(null);
    const chartInst = useRef<any>(null);
    const { id, name, value, minMax, unit = '', colorOrdering = colorOrder.ACS } = props;
    let min, max;
    if (minMax) {
        const [_min, _max] = minMax;
        min = _min;
        max = _max;
    } else {
        console.warn(`Invalid minMax for ${id || name}`);
    }
    const options: EChartsOption = {
        tooltip: {
            formatter: '{a} <br/>{b} : {c}%',
        },
        series: [
            {
                axisLine: {
                    lineStyle: {
                        width: 6,
                        color: GAUGE_COLORS[colorOrdering],
                    },
                },
                pointer: {
                    itemStyle: {
                        color: 'auto',
                    },
                },
                min,
                max,
                name,
                type: 'gauge',
                progress: {
                    show: true,
                    roundCap: true,
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'gray',
                        color: 'auto'
                    },
                    width: 8
                },
                detail: {
                    valueAnimation: true,
                    formatter: '{value}',
                },
                data: [
                    {
                        value,
                    },
                ],
            },
        ],
    };
    useEffect(() => {
        if (chartInst.current !== null && chartRefInst.current !== null) {
            // tmkasun could directly use "chartInst.current.setOption(options)"
            const chart = echarts.getInstanceByDom(chartRefInst.current);
            chart?.setOption(options, true);
        }
    }, [options]);

    useLayoutEffect(() => {
        if (chartRefInst.current !== null) {
            const lineChart = echarts.init(chartRefInst.current);
            // const lineChart = echarts.getInstanceByDom(chartRefInst.current);
            chartInst.current = lineChart;
            lineChart?.setOption(options, true);
        }
    }, []);
    return (
        <Box display="flex" flexDirection="column">
            <StyledEChartRoot id={id || name} ref={chartRefInst} />
            <Box justifyContent="center" display="flex" mt={-13} mb={3}>
                {name}
            </Box>
        </Box>
    );
};

export default EnergyLineChart;
