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

interface ParliamentaryEntry {
  title?: string
  category?: string
  subtype?: string
  session?: string
  date?: string
  speech_count?: number
  contribution_count?: number
  excerpt?: string
}

interface VotingEntry {
  date?: string
  motion?: string
  decision?: string
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
  const parliamentaryProfile = (politician.parliamentary_profile || {}) as Record<string, unknown>
  const committees = Array.isArray(parliamentaryProfile.committee_memberships)
    ? (parliamentaryProfile.committee_memberships as string[])
    : []
  const currentPositions = Array.isArray(parliamentaryProfile.current_positions)
    ? (parliamentaryProfile.current_positions as Array<Record<string, string>>)
    : []
  const parliamentaryActivity = (parliamentaryProfile.parliamentary_activity || {}) as Record<string, unknown>
  const recentContributions = Array.isArray(parliamentaryProfile.recent_contributions)
    ? (parliamentaryProfile.recent_contributions as ParliamentaryEntry[])
    : []
  const votingHistory = Array.isArray(parliamentaryProfile.voting_history)
    ? (parliamentaryProfile.voting_history as VotingEntry[])
    : []

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
              className="h-36 w-36 rounded-full object-cover mx-auto md:mx-0 flex-shrink-0"
            />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{politician.name}</h1>
              <p className="text-lg text-gray-600 mb-2">{politician.position}</p>
              <p className="text-sm text-gray-500 mb-4">
                {politician.party || "Independent"}
                {politician.county ? ` • ${politician.county}` : ""}
                {politician.constituency ? ` • ${politician.constituency} Constituency` : ""}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-4">
                <Badge variant="outline" className={politician.is_alive ? "text-emerald-700" : "text-rose-700"}>
                  {politician.is_alive ? "Alive" : "Deceased"}
                </Badge>
                {politician.parliamentary_role ? <Badge variant="outline">{politician.parliamentary_role}</Badge> : null}
                {politician.date_of_birth ? (
                  <Badge variant="outline">
                    Born {new Date(politician.date_of_birth).toLocaleDateString()}
                  </Badge>
                ) : null}
                {politician.date_of_death ? (
                  <Badge variant="outline">
                    Died {new Date(politician.date_of_death).toLocaleDateString()}
                  </Badge>
                ) : null}
              </div>
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
            <CardTitle>Bio & Political History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Bio</h3>
              <p className="text-gray-700">{politician.bio || "Biography not available yet."}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">History</h3>
              <p className="text-gray-700 whitespace-pre-line">
                {politician.history || politician.bio || "Political history not available yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parliamentary Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {politician.parliamentary_profile_url ? (
              <a
                href={politician.parliamentary_profile_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-700 underline"
              >
                View official parliamentary profile
              </a>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Current Positions</h3>
              {currentPositions.length === 0 ? (
                <p className="text-gray-700">No current parliamentary positions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {currentPositions.map((item, idx) => (
                    <p key={`${item.title || "position"}-${idx}`} className="text-gray-700">
                      {(item.title || "Position") + (item.start_date ? ` (${item.start_date} to ${item.end_date || "Present"})` : "")}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Committee Membership</h3>
              {committees.length === 0 ? (
                <p className="text-gray-700">No committee membership recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {committees.map((committee) => (
                    <Badge key={committee} variant="outline">
                      {committee}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Parliamentary Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Speeches Last Year</p>
                    <p className="text-xl font-semibold">{String(parliamentaryActivity.speeches_last_year ?? "0")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Total Speeches</p>
                    <p className="text-xl font-semibold">{String(parliamentaryActivity.total_speeches ?? "0")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">Bills Sponsored</p>
                    <p className="text-xl font-semibold">{String(parliamentaryActivity.bills_sponsored ?? "0")}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Recent Statements & Contributions</h3>
              {recentContributions.length === 0 ? (
                <p className="text-gray-700">No parliamentary contribution records yet.</p>
              ) : (
                <div className="space-y-4">
                  {recentContributions.slice(0, 8).map((entry, idx) => (
                    <div key={`${entry.title || "entry"}-${idx}`} className="border rounded-md p-3">
                      <p className="font-medium text-gray-900">{entry.title || "Parliamentary entry"}</p>
                      <p className="text-sm text-gray-500">
                        {[entry.date, entry.category, entry.subtype, entry.session].filter(Boolean).join(" • ")}
                      </p>
                      <p className="text-sm text-gray-700 mt-2">{entry.excerpt || "No excerpt recorded."}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Voting History</h3>
              {votingHistory.length === 0 ? (
                <p className="text-gray-700">No voting records available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2">Date</th>
                        <th className="py-2 pr-2">Motion</th>
                        <th className="py-2">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {votingHistory.slice(0, 10).map((vote, idx) => (
                        <tr key={`${vote.motion || "vote"}-${idx}`} className="border-b last:border-0">
                          <td className="py-2 pr-2">{vote.date || "-"}</td>
                          <td className="py-2 pr-2">{vote.motion || "-"}</td>
                          <td className="py-2">{vote.decision || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
