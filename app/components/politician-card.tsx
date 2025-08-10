import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ScoreCard from "./score-card"
import Image from "next/image"
import Link from "next/link"

interface Politician {
  id: string
  name: string
  position: string
  party: string
  county: string
  score: number
  confidence: number
  photo: string
  lastUpdated: string
}

interface PoliticianCardProps {
  politician: Politician
}

export default function PoliticianCard({ politician }: PoliticianCardProps) {
  return (
    <Link href={`/politician/${politician.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <Image
              src={politician.photo || "/placeholder.svg"}
              alt={politician.name}
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{politician.name}</h3>
              <p className="text-gray-600">{politician.position}</p>
              <p className="text-sm text-gray-500">{politician.county}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline">{politician.party}</Badge>
            <span className="text-xs text-gray-500">Updated {politician.lastUpdated}</span>
          </div>
          <ScoreCard score={politician.score} confidence={politician.confidence} />
        </CardContent>
      </Card>
    </Link>
  )
}
