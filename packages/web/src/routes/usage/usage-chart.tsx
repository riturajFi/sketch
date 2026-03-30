import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useState } from "react";
import { Chart } from "react-chartjs-2";
import type { TimePeriod } from "./shared";

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend, Filler);

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function UsageOverTimeChart({
  timePeriod,
  data: usageData,
}: {
  timePeriod: TimePeriod;
  data:
    | {
        period: { from: string; to: string; type: string };
        daily_breakdown: { date: string; messages: number; skills: number }[];
      }
    | undefined;
}) {
  const isDark = useDarkMode();

  const chartData = useMemo(() => {
    if (!usageData) {
      return { labels: [] as string[], messages: [] as number[], skills: [] as number[] };
    }

    const from = new Date(usageData.period.from);
    const to = new Date(usageData.period.to);
    const days = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

    const msgMap = new Map<string, number>();
    const skillMap = new Map<string, number>();
    for (const bucket of usageData.daily_breakdown) {
      msgMap.set(bucket.date, bucket.messages);
      skillMap.set(bucket.date, bucket.skills);
    }

    const labels: string[] = [];
    const messages: number[] = [];
    const skills: number[] = [];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().slice(0, 10);

      if (timePeriod === "Week") {
        labels.push(dayNames[d.getUTCDay()]);
      } else if (timePeriod === "Quarter") {
        labels.push(i % 7 === 0 ? `W${Math.floor(i / 7) + 1}` : "");
      } else {
        const dayNum = d.getUTCDate();
        labels.push(dayNum % 3 === 1 ? `${d.toLocaleString("en", { month: "short", timeZone: "UTC" })} ${dayNum}` : "");
      }

      messages.push(msgMap.get(dateKey) ?? 0);
      skills.push(skillMap.get(dateKey) ?? 0);
    }

    return { labels, messages, skills };
  }, [usageData, timePeriod]);

  const graphData = useMemo(
    () => ({
      labels: chartData.labels,
      datasets: [
        {
          type: "line" as const,
          label: "Messages",
          data: chartData.messages,
          borderColor: "#C8A800",
          backgroundColor: (ctx: {
            chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } };
          }) => {
            const { chart } = ctx;
            const fallback = isDark ? "rgba(200,168,0,0.25)" : "rgba(254,237,1,0.28)";
            if (!chart.chartArea) return fallback;
            const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
            if (isDark) {
              gradient.addColorStop(0, "rgba(200,168,0,0.25)");
              gradient.addColorStop(0.7, "rgba(200,168,0,0.06)");
              gradient.addColorStop(1, "rgba(200,168,0,0)");
            } else {
              gradient.addColorStop(0, "rgba(254,237,1,0.28)");
              gradient.addColorStop(0.7, "rgba(254,237,1,0.08)");
              gradient.addColorStop(1, "rgba(254,237,1,0)");
            }
            return gradient;
          },
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#FEED01",
          pointHoverBackgroundColor: "#FEED01",
          pointBorderColor: "#C8A800",
          pointHoverBorderColor: "#C8A800",
          pointBorderWidth: 1.5,
          fill: true,
          yAxisID: "y",
        },
        {
          type: "line" as const,
          label: "Skills triggered",
          data: chartData.skills,
          borderColor: isDark ? "#444441" : "#B4B2A9",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: [4, 3],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointBackgroundColor: isDark ? "#040404" : "#ffffff",
          pointHoverBackgroundColor: isDark ? "#040404" : "#ffffff",
          pointBorderColor: isDark ? "#5F5E5A" : "#888780",
          pointHoverBorderColor: isDark ? "#5F5E5A" : "#888780",
          pointBorderWidth: 1.5,
          fill: false,
          yAxisID: "y1",
        },
      ],
    }),
    [chartData, isDark],
  );

  const tickColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "#1C1C1A" : "#ffffff",
          titleColor: isDark ? "#FAFAF8" : "#040404",
          titleFont: { family: "IBM Plex Mono", size: 10 },
          bodyColor: isDark ? "#9C9A92" : "#5f5e5a",
          bodyFont: { family: "Inter", size: 11 },
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          borderWidth: 0.5,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: tickColor, font: { family: "Inter", size: 11 }, padding: 4 },
        },
        y: {
          position: "left" as const,
          grid: { color: gridColor, lineWidth: 0.5 },
          border: { display: false, dash: [3, 3] },
          ticks: { color: tickColor, font: { family: "Inter", size: 10 } },
        },
        y1: {
          position: "right" as const,
          grid: { display: false },
          border: { display: false },
          ticks: { color: tickColor, font: { family: "Inter", size: 10 } },
        },
      },
    }),
    [isDark, tickColor, gridColor],
  );

  const skillsLegendGradient = isDark
    ? "repeating-linear-gradient(to right, #444441 0px, #444441 4px, transparent 4px, transparent 7px)"
    : "repeating-linear-gradient(to right, #B4B2A9 0px, #B4B2A9 4px, transparent 4px, transparent 7px)";

  if (!usageData) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Usage over time</p>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-[#C8A800]" />
            Messages
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundImage: skillsLegendGradient }} />
            Skills triggered
          </span>
        </div>
      </div>
      <div className="h-[240px]">
        <Chart type="line" data={graphData} options={options} />
      </div>
    </div>
  );
}
