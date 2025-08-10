"use client"

interface ScoreBreakdownData {
  legalRecord: number
  promiseFulfillment: number
  publicSentiment: number
  educationVerification: number
}

interface ScoreBreakdownChartProps {
  data: ScoreBreakdownData
}

export default function ScoreBreakdownChart({ data }: ScoreBreakdownChartProps) {
  // Create a diamond/radar chart visualization
  const maxScore = 10
  const centerX = 200
  const centerY = 200
  const radius = 120

  // Calculate positions for each metric
  const positions = {
    legalRecord: { x: centerX, y: centerY - radius, label: "Legal Record" },
    promiseFulfillment: { x: centerX + radius, y: centerY, label: "Promise Fulfillment" },
    publicSentiment: { x: centerX, y: centerY + radius, label: "Public Sentiment" },
    educationVerification: { x: centerX - radius, y: centerY, label: "Education Verification" },
  }

  // Calculate actual positions based on scores
  const actualPositions = {
    legalRecord: {
      x: centerX,
      y: centerY - (radius * data.legalRecord) / maxScore,
    },
    promiseFulfillment: {
      x: centerX + (radius * data.promiseFulfillment) / maxScore,
      y: centerY,
    },
    publicSentiment: {
      x: centerX,
      y: centerY + (radius * data.publicSentiment) / maxScore,
    },
    educationVerification: {
      x: centerX - (radius * data.educationVerification) / maxScore,
      y: centerY,
    },
  }

  // Create path for the filled area
  const pathData = `M ${actualPositions.legalRecord.x} ${actualPositions.legalRecord.y} 
                   L ${actualPositions.promiseFulfillment.x} ${actualPositions.promiseFulfillment.y}
                   L ${actualPositions.publicSentiment.x} ${actualPositions.publicSentiment.y}
                   L ${actualPositions.educationVerification.x} ${actualPositions.educationVerification.y} Z`

  return (
    <div className="flex justify-center">
      <svg width="400" height="400" className="overflow-visible">
        {/* Background grid lines */}
        <g stroke="#e5e7eb" strokeWidth="1" fill="none">
          {/* Outer diamond */}
          <path
            d={`M ${positions.legalRecord.x} ${positions.legalRecord.y} 
                   L ${positions.promiseFulfillment.x} ${positions.promiseFulfillment.y}
                   L ${positions.publicSentiment.x} ${positions.publicSentiment.y}
                   L ${positions.educationVerification.x} ${positions.educationVerification.y} Z`}
          />

          {/* Inner diamonds for scale */}
          {[0.5, 0.75].map((scale, i) => (
            <path
              key={i}
              d={`M ${centerX} ${centerY - radius * scale} 
                 L ${centerX + radius * scale} ${centerY}
                 L ${centerX} ${centerY + radius * scale}
                 L ${centerX - radius * scale} ${centerY} Z`}
            />
          ))}

          {/* Cross lines */}
          <line
            x1={positions.legalRecord.x}
            y1={positions.legalRecord.y}
            x2={positions.publicSentiment.x}
            y2={positions.publicSentiment.y}
          />
          <line
            x1={positions.educationVerification.x}
            y1={positions.educationVerification.y}
            x2={positions.promiseFulfillment.x}
            y2={positions.promiseFulfillment.y}
          />
        </g>

        {/* Filled area */}
        <path d={pathData} fill="rgba(34, 197, 94, 0.3)" stroke="rgb(34, 197, 94)" strokeWidth="2" />

        {/* Data points */}
        {Object.entries(actualPositions).map(([key, pos]) => (
          <circle key={key} cx={pos.x} cy={pos.y} r="4" fill="rgb(34, 197, 94)" />
        ))}

        {/* Labels */}
        {Object.entries(positions).map(([key, pos]) => (
          <g key={key}>
            <text
              x={pos.x}
              y={pos.y + (pos.y < centerY ? -15 : pos.y > centerY ? 25 : 0)}
              textAnchor="middle"
              className="text-sm font-medium fill-gray-700"
            >
              {pos.label}
            </text>
            <text
              x={pos.x}
              y={pos.y + (pos.y < centerY ? -5 : pos.y > centerY ? 35 : 10)}
              textAnchor="middle"
              className="text-xs fill-gray-500"
            >
              {data[key as keyof ScoreBreakdownData]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
