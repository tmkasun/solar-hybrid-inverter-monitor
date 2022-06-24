import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  DatasetComponent,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent
} from "echarts/components";
import { LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TitleComponent,
  DatasetComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  CanvasRenderer,
  ToolboxComponent
]);

const REChart = (props) => {
  const chartRef = useRef(null);
  const chartRefInst = useRef(null);
  const { id, options } = props;
  useEffect(() => {
    if (chartRefInst.current) {
      chartRefInst.current.setOption(options, true);
    }
  }, [options]);
  useEffect(() => {
    console.log(chartRef.current);
    if (chartRef.current) {
      const lineChart =
        echarts.getInstanceByDom(chartRef.current) ||
        echarts.init(chartRef.current);
      lineChart.setOption(options, true);
      chartRefInst.current = lineChart;
    }
  }, []);
  return (
    <div id={id} ref={chartRef} style={{ width: "100%", height: "80vh" }} />
  );
};

export default REChart;
