"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import Link from "next/link"
import { getTopPoliticians, listPublicReports, PublicReport } from "@/lib/api"

function toLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

interface TrendingPolitician {
  id: string
  name: string
  photo: string
  score: number
  trend: "high" | "low"
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [alerts, setAlerts] = useState<PublicReport[]>([])
  const [trendingPoliticians, setTrendingPoliticians] = useState<TrendingPolitician[]>([])

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [reportsResponse, topResponse] = await Promise.all([
          listPublicReports({ page: 1, page_size: 10 }),
          getTopPoliticians(6),
        ])

        if (!isMounted) return

        setAlerts(reportsResponse.items)

        const highest = topResponse.highest_scored.map((item, idx) => ({
          id: `high-${idx}`,
          name: item.name,
          photo: "/placeholder.svg",
          score: Math.round(Number(item.transparency_score)),
          trend: "high" as const,
        }))

        const lowest = topResponse.lowest_scored.map((item, idx) => ({
          id: `low-${idx}`,
          name: item.name,
          photo: "/placeholder.svg",
          score: Math.round(Number(item.transparency_score)),
          trend: "low" as const,
        }))

        setTrendingPoliticians([...highest.slice(0, 3), ...lowest.slice(0, 3)])
      } catch {
        if (isMounted) {
          setAlerts([])
          setTrendingPoliticians([])
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab === "all") return true
    if (activeTab === "flagged") return ["under_review", "investigating"].includes(alert.status)
    if (activeTab === "investigation") return alert.status === "investigating"
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Alerts & Trends</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Stay informed with the latest flagged updates and trending politicians.
          </p>
        </div>

        <div className="mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
              <TabsTrigger value="all">All Alerts</TabsTrigger>
              <TabsTrigger value="flagged" className="bg-green-600 text-white data-[state=active]:bg-green-700">
                Flagged Updates
              </TabsTrigger>
              <TabsTrigger value="investigation">Under Investigation</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Flagged Updates</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Update ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Politician
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Issue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Reported
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAlerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {alert.id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.politician_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">{alert.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              {toLabel(alert.status)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(alert.date_reported).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link href={`/flagged-updates/${alert.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Top and Bottom Transparency Scores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingPoliticians.map((politician) => (
                <Card key={politician.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <Image
                      src={politician.photo || "/placeholder.svg"}
                      alt={politician.name}
                      width={80}
                      height={80}
                      className="rounded-full mx-auto mb-4 object-cover"
                    />
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{politician.name}</h3>
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={`text-2xl font-bold ${
                          politician.trend === "high" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {politician.trend === "high" ? "↗" : "↘"} {politician.score}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {politician.trend === "high" ? "High transparency" : "Needs improvement"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
