import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from "echarts/components";
import { PieChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  PieChart,
  CanvasRenderer
]);

const REPieChart = (props) => {
  const chartRef = useRef(null);
  const chartRefInst = useRef(null);
  const { id, options } = props;
  useEffect(() => {
    if (chartRefInst.current) {
      chartRefInst.current.setOption(options);
    }
  }, [options]);
  useEffect(() => {
    console.log(chartRef.current);
    if (chartRef.current) {
      const pieChart =
        echarts.getInstanceByDom(chartRef.current) ||
        echarts.init(chartRef.current);
      pieChart.setOption(options);
      chartRefInst.current = pieChart;
    }
  }, []);
  return (
    <div id={id} ref={chartRef} style={{ width: "100%", height: "80vh" }} />
  );
};

export default REPieChart;
