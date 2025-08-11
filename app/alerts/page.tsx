"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import Link from "next/link"

interface Alert {
  id: string
  politician: string
  issue: string
  status: "Under Review" | "Verified" | "Closed"
  dateReported: string
}

interface TrendingPolitician {
  id: string
  name: string
  photo: string
  changePercent: number
  changeType: "increase" | "decrease"
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("all")

  const alerts: Alert[] = [
    {
      id: "ALRT-001",
      politician: "Hon. Jane Wanjiku",
      issue: "Allegations of Misuse of Public Funds",
      status: "Under Review",
      dateReported: "2024-07-28",
    },
    {
      id: "ALRT-004",
      politician: "Gov. Peter Oshieng",
      issue: "Irregularities in Land Allocation",
      status: "Under Review",
      dateReported: "2024-07-20",
    },
  ]

  const trendingPoliticians: TrendingPolitician[] = [
    {
      id: "1",
      name: "Hon. Benjamin Njoroge",
      photo: "/placeholder.svg?height=80&width=80&text=Benjamin+Njoroge",
      changePercent: 18,
      changeType: "increase",
    },
    {
      id: "2",
      name: "Ms. Sarah Adhiambo",
      photo: "/placeholder.svg?height=80&width=80&text=Sarah+Adhiambo",
      changePercent: 7,
      changeType: "increase",
    },
    {
      id: "3",
      name: "Dr. Alex Kipkemboi",
      photo: "/placeholder.svg?height=80&width=80&text=Alex+Kipkemboi",
      changePercent: 12,
      changeType: "decrease",
    },
    {
      id: "4",
      name: "Chief Daniel Mwangi",
      photo: "/placeholder.svg?height=80&width=80&text=Daniel+Mwangi",
      changePercent: 9,
      changeType: "increase",
    },
    {
      id: "5",
      name: "Pastor Mary Njeri",
      photo: "/placeholder.svg?height=80&width=80&text=Mary+Njeri",
      changePercent: 5,
      changeType: "decrease",
    },
    {
      id: "6",
      name: "Engineer Tom Omondi",
      photo: "/placeholder.svg?height=80&width=80&text=Tom+Omondi",
      changePercent: 25,
      changeType: "increase",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Alerts & Trends</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Stay informed with the latest flagged updates and track the most discussed politicians across Kenya.
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
                      {alerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{alert.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.politician}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">{alert.issue}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              {alert.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.dateReported}</td>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Trending Politicians</h2>
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
                          politician.changeType === "increase" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {politician.changeType === "increase" ? "↗" : "↘"} {politician.changePercent}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Change in query volume</p>
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
