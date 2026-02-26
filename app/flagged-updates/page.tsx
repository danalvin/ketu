"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Eye, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import { listPublicReports, PublicReport } from "@/lib/api"

function toLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export default function FlaggedUpdatesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards")
  const [updates, setUpdates] = useState<PublicReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      setLoading(true)
      try {
        const response = await listPublicReports({
          page: 1,
          page_size: 100,
          q: searchQuery || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
        })

        if (isMounted) {
          setUpdates(response.items)
        }
      } catch {
        if (isMounted) {
          setUpdates([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      isMounted = false
    }
  }, [searchQuery, statusFilter, priorityFilter])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "under_review":
        return <Clock className="h-4 w-4" />
      case "investigating":
        return <AlertTriangle className="h-4 w-4" />
      case "verified":
      case "resolved":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "under_review":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "investigating":
        return "bg-red-100 text-red-800 border-red-200"
      case "verified":
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200"
      case "dismissed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
      case "critical":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const statusCounts = useMemo(
    () => ({
      total: updates.length,
      under_review: updates.filter((u) => u.status === "under_review").length,
      investigating: updates.filter((u) => u.status === "investigating").length,
      verified: updates.filter((u) => u.status === "verified").length,
      dismissed: updates.filter((u) => u.status === "dismissed").length,
    }),
    [updates],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Flagged Updates</h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Monitor and track flagged incidents and allegations against Kenyan politicians.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.total}</div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.under_review}</div>
              <div className="text-sm text-gray-600">Under Review</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.investigating}</div>
              <div className="text-sm text-gray-600">Investigating</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.verified}</div>
              <div className="text-sm text-gray-600">Verified</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.dismissed}</div>
              <div className="text-sm text-gray-600">Dismissed</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search politician or issue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="flex-1"
                >
                  Cards
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="flex-1"
                >
                  Table
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                  setPriorityFilter("all")
                }}
              >
                Clear Filters
              </Button>
              <div className="text-sm text-gray-600 flex items-center">Showing {updates.length} reports</div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(6)].map((_, idx) => (
              <Card key={idx} className="animate-pulse">
                <CardContent className="p-6 h-40 bg-gray-100" />
              </Card>
            ))}
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {updates.map((update) => (
              <Card key={update.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Image
                      src={update.politician_photo_url || "/placeholder.svg"}
                      alt={update.politician_name}
                      width={60}
                      height={60}
                      className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{update.politician_name}</h3>
                          <p className="text-sm text-gray-600">{update.politician_position || "Position unavailable"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getPriorityColor(update.priority)}>{toLabel(update.priority)}</Badge>
                          <Badge className={getStatusColor(update.status)}>
                            {getStatusIcon(update.status)}
                            <span className="ml-1">{toLabel(update.status)}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{update.title}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{update.description}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{format(new Date(update.date_reported), "MMM dd, yyyy")}</span>
                      <span>ID: {update.id.slice(0, 8)}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Link href={`/flagged-updates/${update.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-700">Report</th>
                      <th className="text-left p-4 font-medium text-gray-700">Politician</th>
                      <th className="text-left p-4 font-medium text-gray-700">Status</th>
                      <th className="text-left p-4 font-medium text-gray-700">Priority</th>
                      <th className="text-left p-4 font-medium text-gray-700">Date</th>
                      <th className="text-left p-4 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.map((update) => (
                      <tr key={update.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-gray-900">{update.title}</p>
                            <p className="text-sm text-gray-600 line-clamp-1">{update.issue_type}</p>
                          </div>
                        </td>
                        <td className="p-4 text-gray-700">{update.politician_name}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(update.status)}>
                            {getStatusIcon(update.status)}
                            <span className="ml-1">{toLabel(update.status)}</span>
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge className={getPriorityColor(update.priority)}>{toLabel(update.priority)}</Badge>
                        </td>
                        <td className="p-4 text-gray-600">{format(new Date(update.date_reported), "MMM dd, yyyy")}</td>
                        <td className="p-4">
                          <Link href={`/flagged-updates/${update.id}`}>
                            <Button variant="outline" size="sm">
                              View
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
        )}
      </div>
    </div>
  )
}
