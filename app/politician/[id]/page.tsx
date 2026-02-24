import { Suspense } from "react"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MoreHorizontal } from "lucide-react"
import ScoreBreakdownChart from "../../components/score-breakdown-chart"
import PoliticalLinkages from "../../components/political-linkages"
import { getPolitician, getPoliticianCases, getPoliticianPromises } from "@/lib/api"

interface PoliticianProfileProps {
  params: {
    id: string
  }
}

function toTenPointScore(score: number): number {
  return Math.max(0, Math.min(10, Number((score / 10).toFixed(1))))
}

function toCaseBadgeClass(status: string) {
  const normalized = status.toLowerCase()
  if (["pending", "ongoing", "appealed"].includes(normalized)) {
    return "bg-red-100 text-red-800"
  }
  if (normalized === "resolved") {
    return "bg-green-100 text-green-800"
  }
  return "bg-gray-100 text-gray-800"
}

export default async function PoliticianProfile({ params }: PoliticianProfileProps) {
  let politician
  let cases
  let promises

  try {
    ;[politician, cases, promises] = await Promise.all([
      getPolitician(params.id),
      getPoliticianCases(params.id, { page: 1, page_size: 20 }),
      getPoliticianPromises(params.id, { page: 1, page_size: 20 }),
    ])
  } catch {
    notFound()
  }

  const score = Math.round(Number(politician.transparency_score))
  const confidence = Math.round(Number(politician.confidence_level))
  const baseTenScore = toTenPointScore(score)
  const scoreBreakdown = {
    legalRecord: baseTenScore,
    promiseFulfillment: baseTenScore,
    publicSentiment: baseTenScore,
    educationVerification: baseTenScore,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Image
              src={politician.photo_url || "/placeholder.svg"}
              alt={politician.name}
              width={150}
              height={150}
              className="rounded-full object-cover mx-auto md:mx-0"
            />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{politician.name}</h1>
              <p className="text-lg text-gray-600 mb-2">{politician.position}</p>
              <p className="text-sm text-gray-500 mb-4">
                {politician.party || "Independent"} {politician.county ? `• ${politician.county}` : ""}
              </p>
              <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-bold text-green-600">{score}</span>
                  <Badge className="bg-green-100 text-green-800">Confidence {confidence}%</Badge>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Last updated: {new Date(politician.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MoreHorizontal className="h-6 w-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-200 animate-pulse rounded" />}>
              <ScoreBreakdownChart data={scoreBreakdown} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cases & Investigations ({cases.total})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {cases.items.length === 0 ? <p className="text-gray-600">No cases available.</p> : null}
            {cases.items.map((caseItem) => (
              <div key={caseItem.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                <div className="flex items-start justify-between mb-3 gap-4">
                  <h3 className="font-semibold text-lg text-gray-900">{caseItem.title}</h3>
                  <Badge variant="secondary" className={toCaseBadgeClass(caseItem.status)}>
                    {caseItem.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {caseItem.date_filed ? new Date(caseItem.date_filed).toLocaleDateString() : "Date not set"}
                </p>
                <p className="text-gray-700">{caseItem.description || "No description provided."}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promises & Projects ({promises.total})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {promises.items.length === 0 ? <p className="text-gray-600">No promises available.</p> : null}
            {promises.items.map((promise) => {
              const progress = promise.fulfillment_percentage
              return (
                <div key={promise.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-lg text-gray-900">{promise.title}</h3>
                    <Badge
                      variant="outline"
                      className={
                        progress >= 80
                          ? "bg-green-100 text-green-800"
                          : progress >= 50
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
                          progress >= 80 ? "bg-green-600" : progress >= 50 ? "bg-yellow-600" : "bg-red-600"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-gray-700">{promise.description}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Political Linkages</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 bg-gray-200 animate-pulse rounded" />}>
              <PoliticalLinkages
                associates={[]}
                politician={{ id: politician.id, name: politician.name, position: politician.position }}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
