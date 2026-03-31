// src/features/notification-hub/components/MetricsCard.tsx

import type { HubMetrics } from "../types";
import { formatMinutes } from "../utils/formatters";

interface MetricsCardProps {
  metrics: HubMetrics;
}

export function MetricsCard({ metrics }: MetricsCardProps) {
  return (
    <div className="mt-12 p-4 border border-outline-variant bg-surface-container-lowest">
      <div className="flex justify-between items-end">
        <div>
          <p className="font-label text-[9px] tracking-widest text-zinc-500 uppercase mb-1">
            Avg Response Time
          </p>
          <p className="font-headline text-3xl tracking-tighter">
            {Math.round(metrics.avgResponseTimeMinutes)}
            <span className="text-sm font-body tracking-normal ml-1">
              m
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-label text-[9px] tracking-widest text-tertiary uppercase mb-1">
            Criticality
          </p>
          <p
            className="font-body text-xs font-bold"
            style={{
              color: metrics.criticality === "CRITICAL" ? "#ba1a1a" :
                     metrics.criticality === "ELEVATED" ? "#701f00" :
                     "#1a1c1c"
            }}
          >
            {metrics.criticality}
          </p>
        </div>
      </div>
    </div>
  );
}