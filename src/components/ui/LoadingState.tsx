import { useEffect, useState } from "react";

const driveDelays = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return (column + Math.abs(row - 1)) * 90;
});

export default function LoadingState({
  label = "Searching verified records",
  progressLabel = "Working",
}: {
  label?: string;
  progressLabel?: string;
}) {
  const [tenths, setTenths] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTenths((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = tenths / 10;
  const elapsed = seconds < 60
    ? `${seconds.toFixed(1)}s`
    : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;

  return (
    <div className="loading-state" role="status" aria-label={`${label}, ${elapsed}`}>
      <span className="loading-grid" aria-hidden="true">
        {driveDelays.map((delay, index) => (
          <span key={index} style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
      <span className="loading-copy"><strong>{label}</strong><small>{progressLabel}</small></span>
      <span className="loading-elapsed">{elapsed}</span>
      <span className="loading-progress" aria-hidden="true"><i /></span>
    </div>
  );
}
