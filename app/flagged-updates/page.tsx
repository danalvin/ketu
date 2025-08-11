"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Eye, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import Image from "next/image"

interface FlaggedUpdate {
  id: string
  politician: {
    name: string
    position: string
    photo: string
    id: string
  }
  issue: string
  description: string
  status: "Under Review" | "Verified" | "Dismissed" | "Investigating"
  priority: "High" | "Medium" | "Low"
  dateReported: string
  reportedBy: string
  category: string
  evidence: number
  lastUpdated: string
}

export default function FlaggedUpdatesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards")

  const flaggedUpdates: FlaggedUpdate[] = [
    {
      id: "ALRT-001",
      politician: {
        name: "Hon. Jane Wanjiku",
        position: "Member of Parliament",
        photo: "/placeholder.svg?height=60&width=60&text=Jane+Wanjiku",
        id: "jane-wanjiku",
      },
      issue: "Allegations of Misuse of Public Funds",
      description:
        "Reports indicate irregular allocation of constituency development funds totaling KSh 15M. Multiple sources have provided evidence of inflated contracts and ghost projects.",
      status: "Under Review",
      priority: "High",
      dateReported: "2024-07-28",
      reportedBy: "Anonymous Citizen",
      category: "Financial Misconduct",
      evidence: 5,
      lastUpdated: "2024-08-01",
    },
    {
      id: "ALRT-002",
      politician: {
        name: "Gov. Peter Oshieng",
        position: "County Governor",
        photo: "/placeholder.svg?height=60&width=60&text=Peter+Oshieng",
        id: "peter-oshieng",
      },
      issue: "Irregularities in Land Allocation",
      description:
        "Investigation into questionable land allocation processes in prime county locations. Allegations include favoritism and bypassing of proper procedures.",
      status: "Investigating",
      priority: "High",
      dateReported: "2024-07-20",
      reportedBy: "Civil Society Organization",
      category: "Land Issues",
      evidence: 3,
      lastUpdated: "2024-07-25",
    },
    {
      id: "ALRT-003",
      politician: {
        name: "Sen. Mary Kiprotich",
        position: "Senator",
        photo: "/placeholder.svg?height=60&width=60&text=Mary+Kiprotich",
        id: "mary-kiprotich",
      },
      issue: "Failure to Attend Senate Sessions",
      description:
        "Consistent absence from critical senate sessions without valid justification. Attendance records show 70% absenteeism over the past 6 months.",
      status: "Verified",
      priority: "Medium",
      dateReported: "2024-07-15",
      reportedBy: "Parliamentary Watch Group",
      category: "Performance Issues",
      evidence: 2,
      lastUpdated: "2024-07-18",
    },
    {
      id: "ALRT-004",
      politician: {
        name: "MCA David Mutua",
        position: "Member of County Assembly",
        photo: "/placeholder.svg?height=60&width=60&text=David+Mutua",
        id: "david-mutua",
      },
      issue: "Conflict of Interest in Tender Awards",
      description:
        "Allegations of awarding county tenders to companies owned by family members. Investigation ongoing into procurement processes.",
      status: "Under Review",
      priority: "High",
      dateReported: "2024-07-10",
      reportedBy: "Transparency International",
      category: "Conflict of Interest",
      evidence: 4,
      lastUpdated: "2024-07-12",
    },
    {
      id: "ALRT-005",
      politician: {
        name: "Hon. Grace Wambui",
        position: "Women Representative",
        photo: "/placeholder.svg?height=60&width=60&text=Grace+Wambui",
        id: "grace-wambui",
      },
      issue: "Misrepresentation of Academic Credentials",
      description:
        "Questions raised about the authenticity of claimed university degrees. Academic institutions contacted for verification.",
      status: "Dismissed",
      priority: "Low",
      dateReported: "2024-06-28",
      reportedBy: "Media Investigation",
      category: "Credential Verification",
      evidence: 1,
      lastUpdated: "2024-07-05",
    },
    {
      id: "ALRT-006",
      politician: {
        name: "Gov. Samuel Cheruiyot",
        position: "County Governor",
        photo: "/placeholder.svg?height=60&width=60&text=Samuel+Cheruiyot",
        id: "samuel-cheruiyot",
      },
      issue: "Delayed Implementation of Development Projects",
      description:
        "Multiple county development projects remain stalled despite budget allocation. Citizens report lack of progress on promised infrastructure.",
      status: "Under Review",
      priority: "Medium",
      dateReported: "2024-06-15",
      reportedBy: "County Residents Association",
      category: "Project Management",
      evidence: 6,
      lastUpdated: "2024-06-20",
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Under Review":
        return <Clock className="h-4 w-4" />
      case "Investigating":
        return <AlertTriangle className="h-4 w-4" />
      case "Verified":
        return <CheckCircle className="h-4 w-4" />
      case "Dismissed":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Under Review":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Investigating":
        return "bg-red-100 text-red-800 border-red-200"
      case "Verified":
        return "bg-green-100 text-green-800 border-green-200"
      case "Dismissed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800"
      case "Medium":
        return "bg-yellow-100 text-yellow-800"
      case "Low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredUpdates = flaggedUpdates.filter((update) => {
    const matchesSearch =
      update.politician.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      update.issue.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || update.status === statusFilter
    const matchesPriority = priorityFilter === "all" || update.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  const statusCounts = {
    all: flaggedUpdates.length,
    "Under Review": flaggedUpdates.filter((u) => u.status === "Under Review").length,
    Investigating: flaggedUpdates.filter((u) => u.status === "Investigating").length,
    Verified: flaggedUpdates.filter((u) => u.status === "Verified").length,
    Dismissed: flaggedUpdates.filter((u) => u.status === "Dismissed").length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Flagged Updates</h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Monitor and track all flagged incidents and allegations against Kenyan politicians. Our verification team
            investigates each report to ensure accuracy and transparency.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Card key={status} className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-600 capitalize">{status === "all" ? "Total Reports" : status}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
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
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Investigating">Investigating</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="High">High Priority</SelectItem>
                  <SelectItem value="Medium">Medium Priority</SelectItem>
                  <SelectItem value="Low">Low Priority</SelectItem>
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
                  setDateFrom(undefined)
                  setDateTo(undefined)
                }}
              >
                Clear Filters
              </Button>
              <div className="text-sm text-gray-600 flex items-center">
                Showing {filteredUpdates.length} of {flaggedUpdates.length} reports
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredUpdates.map((update) => (
              <Card key={update.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Image
                      src={update.politician.photo || "/placeholder.svg"}
                      alt={update.politician.name}
                      width={60}
                      height={60}
                      className="rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{update.politician.name}</h3>
                          <p className="text-sm text-gray-600">{update.politician.position}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getPriorityColor(update.priority)}>{update.priority}</Badge>
                          <Badge className={getStatusColor(update.status)}>
                            {getStatusIcon(update.status)}
                            <span className="ml-1">{update.status}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{update.issue}</h4>
                      <p className="text-sm text-gray-600 line-clamp-3">{update.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <span className="ml-1 font-medium">{update.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Evidence:</span>
                        <span className="ml-1 font-medium">{update.evidence} items</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Reported:</span>
                        <span className="ml-1 font-medium">
                          {format(new Date(update.dateReported), "MMM dd, yyyy")}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Updated:</span>
                        <span className="ml-1 font-medium">{format(new Date(update.lastUpdated), "MMM dd, yyyy")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-xs text-gray-500">Reported by: {update.reportedBy}</div>
                      <Link href={`/flagged-updates/${update.id}`}>
                        <Button size="sm" variant="outline" className="flex items-center gap-1 bg-transparent">
                          <Eye className="h-3 w-3" />
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
                        Priority
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
                    {filteredUpdates.map((update) => (
                      <tr key={update.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{update.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Image
                              src={update.politician.photo || "/placeholder.svg"}
                              alt={update.politician.name}
                              width={40}
                              height={40}
                              className="rounded-full object-cover mr-3"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{update.politician.name}</div>
                              <div className="text-sm text-gray-500">{update.politician.position}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate">{update.issue}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getPriorityColor(update.priority)}>{update.priority}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusColor(update.status)}>
                            {getStatusIcon(update.status)}
                            <span className="ml-1">{update.status}</span>
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(update.dateReported), "MMM dd, yyyy")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/flagged-updates/${update.id}`}>
                            <Button size="sm" variant="outline">
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
        )}

        {filteredUpdates.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No flagged updates found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
