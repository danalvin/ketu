import { Badge } from "@/components/ui/badge"

interface ScoreCardProps {
  score: number
  confidence: number
  size?: "sm" | "md" | "lg"
}

export default function ScoreCard({ score, confidence, size = "md" }: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100"
    if (score >= 60) return "text-yellow-600 bg-yellow-100"
    if (score >= 40) return "text-orange-600 bg-orange-100"
    return "text-red-600 bg-red-100"
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-600"
    if (confidence >= 60) return "bg-yellow-600"
    return "bg-red-600"
  }

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`font-bold ${sizeClasses[size]} ${getScoreColor(score)} px-3 py-1 rounded-full`}>{score}</div>
        <span className="text-gray-600">Transparency Score</span>
      </div>
      <Badge className={`${getConfidenceColor(confidence)} text-white`}>{confidence}% Confidence</Badge>
    </div>
  )
}
