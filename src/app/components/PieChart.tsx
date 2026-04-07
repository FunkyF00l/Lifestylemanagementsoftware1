interface PieChartProps {
  percentage: number;
  color: string;
  size?: number;
  indefinite?: boolean;
}

export function PieChart({ percentage, color, size = 48, indefinite = false }: PieChartProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = indefinite ? circumference * 0.25 : circumference * (1 - percentage / 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D0D0D0"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
          style={indefinite ? { animation: 'pie-spin 3s linear infinite', transformOrigin: 'center' } : undefined}
        />
      </svg>
      {indefinite ? (
        <span
          className="absolute text-[5px] tracking-tight text-center leading-tight"
          style={{ color, fontWeight: 800 }}
        >
          on the
          <br />
          way...
        </span>
      ) : (
        <span
          className="absolute text-[10px]"
          style={{ color, fontWeight: 800 }}
        >
          {percentage}%
        </span>
      )}
      {indefinite && (
        <style>{`
          @keyframes pie-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}
