import React, { useEffect, useLayoutEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsOption, ECharts, SetOptionOpts } from 'echarts';

import { TitleComponent } from 'echarts/components';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

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

echarts.use([TitleComponent, GaugeChart, CanvasRenderer]);
type InverterGaugeChartProps = {
    value: number;
    name: string;
    id: string;
    minMax: [number, number];
};
const EnergyLineChart = (props: InverterGaugeChartProps) => {
    const chartRefInst = useRef<HTMLDivElement | null>(null);
    const chartInst = useRef<any>(null);
    const { id, name, value, minMax } = props;
    const [min, max] = minMax;
    const valueDiff = min + (max - min);
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
    return (
        <div
            id={id}
            ref={chartRefInst}
            style={{ width: '100%', height: '400px' }}
        />
    );
};

export default EnergyLineChart;
