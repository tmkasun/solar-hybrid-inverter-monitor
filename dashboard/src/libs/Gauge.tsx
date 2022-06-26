import { useEffect, useLayoutEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import { TitleComponent, TooltipComponent } from 'echarts/components';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { styled } from '@mui/material';

const StyledEChartRoot = styled('div')({
    width: '50%',
    height: '400px',
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

echarts.use([TitleComponent, GaugeChart, CanvasRenderer, TooltipComponent]);
type InverterGaugeChartProps = {
    value: number;
    name: string;
    id?: string;
    minMax: [number, number];
};
const EnergyLineChart = (props: InverterGaugeChartProps) => {
    const chartRefInst = useRef<HTMLDivElement | null>(null);
    const chartInst = useRef<any>(null);
    const { id, name, value, minMax } = props;
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
                        color: [
                            [0.25, '#FF6E76'],
                            [0.5, '#FDDD60'],
                            [0.75, '#58D9F9'],
                            [1, '#7CFFB2'],
                        ],
                    },
                },
                pointer: {
                    itemStyle: {
                        color: 'auto',
                    },
                },
                min,
                max,
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
                        value,
                        name,
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
    return <StyledEChartRoot id={id || name} ref={chartRefInst} />;
};

export default EnergyLineChart;
