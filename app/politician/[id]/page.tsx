import { Suspense } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MoreHorizontal } from "lucide-react"
import ScoreBreakdownChart from "../../components/score-breakdown-chart"
import PoliticalLinkages from "../../components/political-linkages"

interface PoliticianProfileProps {
  params: {
    id: string
  }
}

// Mock data
const mockPolitician = {
  id: "1",
  name: "Hon. Margaret Kenyatta",
  position: "Member of Parliament for Dagoretti North",
  photo: "/placeholder.svg?height=150&width=150&text=Margaret+Kenyatta",
  score: 8.2,
  confidence: "High Confidence",
  lastUpdated: "October 26, 2023",
  scoreBreakdown: {
    legalRecord: 9,
    promiseFulfillment: 8,
    publicSentiment: 7,
    educationVerification: 9,
  },
  cases: [
    {
      id: "1",
      title: "Allegations of Land Irregularities",
      status: "Ongoing",
      date: "March 15, 2022",
      description:
        "Investigation into alleged irregular acquisition of public land in Nairobi. Authorities are currently reviewing documents and witness statements.",
    },
    {
      id: "2",
      title: "Misappropriation of Constituency Development Funds",
      status: "Closed",
      date: "September 10, 2021",
      description:
        "Case closed due to insufficient evidence after a two-year investigation. Funds were accounted for through detailed audit reports.",
    },
  ],
  promises: [
    {
      id: "1",
      title: "Construct New Health Clinic in Riruta",
      status: "Near Completion (95%)",
      progress: 95,
      description:
        "The Riruta Health Clinic is 95% complete, with equipment installation underway. Expected to open by December 2023.",
    },
    {
      id: "2",
      title: "Implement Youth Employment Program",
      status: "In Progress (60%)",
      progress: 60,
      description: "A pilot program has engaged 200 youths in vocational training. Expansion is planned for Q1 2024.",
    },
    {
      id: "3",
      title: "Improve Road Infrastructure in Kawangware",
      status: "Delayed (30%)",
      progress: 30,
      description:
        "Road construction started but faced delays due to budget allocation issues. Resumption expected in Q4 2023.",
    },
  ],
  keyAssociates: [
    {
      id: "1",
      name: "Dr. David Kimani",
      position: "Cabinet Secretary for Health",
      photo: "/placeholder.svg?height=50&width=50&text=David+Kimani",
    },
    {
      id: "2",
      name: "Hon. Aisha Hassan",
      position: "Senator, Mombasa County",
      photo: "/placeholder.svg?height=50&width=50&text=Aisha+Hassan",
    },
    {
      id: "3",
      name: "Eng. Peter Mwangi",
      position: "County Executive Committee Member",
      photo: "/placeholder.svg?height=50&width=50&text=Peter+Mwangi",
    },
  ],
}

export default function PoliticianProfile({ params }: PoliticianProfileProps) {
  const politician = mockPolitician

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Image
              src={politician.photo || "/placeholder.svg"}
              alt={politician.name}
              width={150}
              height={150}
              className="rounded-full object-cover mx-auto md:mx-0"
            />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{politician.name}</h1>
              <p className="text-lg text-gray-600 mb-4">{politician.position}</p>
              <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold text-green-600">{politician.score}</span>
                  <Badge className="bg-green-100 text-green-800">{politician.confidence}</Badge>
                </div>
              </div>
              <p className="text-sm text-gray-500">Last updated: {politician.lastUpdated}</p>
            </div>
            <div className="flex items-center gap-2">
              <MoreHorizontal className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Score Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-200 animate-pulse rounded" />}>
              <ScoreBreakdownChart data={politician.scoreBreakdown} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Cases & Investigations */}
        <Card>
          <CardHeader>
            <CardTitle>Cases & Investigations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {politician.cases.map((case_) => (
              <div key={case_.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg text-gray-900">{case_.title}</h3>
                  <Badge
                    variant={case_.status === "Ongoing" ? "destructive" : "secondary"}
                    className={case_.status === "Ongoing" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}
                  >
                    {case_.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mb-2">{case_.date}</p>
                <p className="text-gray-700">{case_.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Promises & Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Promises & Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {politician.promises.map((promise) => (
              <div key={promise.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg text-gray-900">{promise.title}</h3>
                  <Badge
                    variant="outline"
                    className={
                      promise.progress >= 80
                        ? "bg-green-100 text-green-800"
                        : promise.progress >= 50
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }
                  >
                    {promise.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        promise.progress >= 80
                          ? "bg-green-600"
                          : promise.progress >= 50
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }`}
                      style={{ width: `${promise.progress}%` }}
                    />
                  </div>
                  <p className="text-gray-700">{promise.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Political Linkages */}
        <Card>
          <CardHeader>
            <CardTitle>Political Linkages</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 bg-gray-200 animate-pulse rounded" />}>
              <PoliticalLinkages associates={politician.keyAssociates} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
