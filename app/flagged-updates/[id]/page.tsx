import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, User, FileText, AlertTriangle, Clock, CheckCircle, Eye, Download } from "lucide-react"
import { format } from "date-fns"

interface FlaggedUpdateDetailProps {
  params: {
    id: string
  }
}

// Mock data for the detailed view
const mockFlaggedUpdate = {
  id: "ALRT-001",
  politician: {
    name: "Hon. Jane Wanjiku",
    position: "Member of Parliament for Dagoretti North",
    photo: "/placeholder.svg?height=120&width=120&text=Jane+Wanjiku",
    id: "jane-wanjiku",
    party: "Democratic Party",
    county: "Nairobi",
  },
  issue: "Allegations of Misuse of Public Funds",
  description:
    "Reports indicate irregular allocation of constituency development funds totaling KSh 15M. Multiple sources have provided evidence of inflated contracts and ghost projects. The investigation reveals discrepancies in procurement processes and potential conflict of interest in contractor selection.",
  status: "Under Review",
  priority: "High",
  dateReported: "2024-07-28",
  reportedBy: "Anonymous Citizen",
  category: "Financial Misconduct",
  evidence: 5,
  lastUpdated: "2024-08-01",
  timeline: [
    {
      date: "2024-07-28",
      action: "Report Submitted",
      description: "Initial report received from anonymous citizen with supporting documents",
      status: "completed",
    },
    {
      date: "2024-07-29",
      action: "Preliminary Review",
      description: "Report assigned to investigation team for initial assessment",
      status: "completed",
    },
    {
      date: "2024-07-30",
      action: "Evidence Collection",
      description: "Additional evidence requested from relevant government departments",
      status: "completed",
    },
    {
      date: "2024-08-01",
      action: "Stakeholder Interviews",
      description: "Interviews scheduled with key witnesses and stakeholders",
      status: "in-progress",
    },
    {
      date: "2024-08-05",
      action: "Final Assessment",
      description: "Comprehensive review and final determination pending",
      status: "pending",
    },
  ],
  evidenceItems: [
    {
      id: "1",
      type: "Document",
      title: "Procurement Records",
      description: "Official procurement documents showing irregular tender processes",
      dateSubmitted: "2024-07-28",
      verified: true,
    },
    {
      id: "2",
      type: "Financial Records",
      title: "Bank Statements",
      description: "Financial transactions related to the alleged misuse of funds",
      dateSubmitted: "2024-07-28",
      verified: true,
    },
    {
      id: "3",
      type: "Witness Statement",
      title: "Contractor Testimony",
      description: "Statement from contractor regarding inflated contract values",
      dateSubmitted: "2024-07-29",
      verified: false,
    },
    {
      id: "4",
      type: "Photo Evidence",
      title: "Project Site Photos",
      description: "Images showing incomplete or non-existent projects",
      dateSubmitted: "2024-07-30",
      verified: true,
    },
    {
      id: "5",
      type: "Audio Recording",
      title: "Phone Conversation",
      description: "Recorded conversation discussing the irregular allocations",
      dateSubmitted: "2024-07-30",
      verified: false,
    },
  ],
  relatedReports: [
    {
      id: "ALRT-007",
      politician: "Hon. Jane Wanjiku",
      issue: "Delayed Project Implementation",
      status: "Dismissed",
      dateReported: "2024-06-15",
    },
    {
      id: "ALRT-012",
      politician: "Hon. Jane Wanjiku",
      issue: "Attendance Issues",
      status: "Verified",
      dateReported: "2024-05-20",
    },
  ],
}

export default function FlaggedUpdateDetail({ params }: FlaggedUpdateDetailProps) {
  const update = mockFlaggedUpdate

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/flagged-updates">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Flagged Updates
            </Button>
          </Link>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex items-start gap-4">
                <Image
                  src={update.politician.photo || "/placeholder.svg"}
                  alt={update.politician.name}
                  width={120}
                  height={120}
                  className="rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{update.id}</h1>
                    <Badge className={getStatusColor(update.status)}>
                      {getStatusIcon(update.status)}
                      <span className="ml-1">{update.status}</span>
                    </Badge>
                    <Badge className={getPriorityColor(update.priority)}>{update.priority} Priority</Badge>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{update.issue}</h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <Link href={`/politician/${update.politician.id}`} className="hover:text-blue-600">
                        {update.politician.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Reported on {format(new Date(update.dateReported), "MMMM dd, yyyy")}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {update.evidence} pieces of evidence
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:ml-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <div className="font-medium">{update.category}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Reported By:</span>
                    <div className="font-medium">{update.reportedBy}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Updated:</span>
                    <div className="font-medium">{format(new Date(update.lastUpdated), "MMM dd, yyyy")}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Politician:</span>
                    <div className="font-medium">{update.politician.position}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="related">Related Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed">{update.description}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Politician Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{update.politician.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Position:</span>
                      <span className="font-medium">{update.politician.position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Party:</span>
                      <span className="font-medium">{update.politician.party}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">County:</span>
                      <span className="font-medium">{update.politician.county}</span>
                    </div>
                    <div className="pt-3 border-t">
                      <Link href={`/politician/${update.politician.id}`}>
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Investigation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Current Status:</span>
                      <Badge className={getStatusColor(update.status)}>
                        {getStatusIcon(update.status)}
                        <span className="ml-1">{update.status}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Priority Level:</span>
                      <Badge className={getPriorityColor(update.priority)}>{update.priority}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Evidence Items:</span>
                      <span className="font-medium">{update.evidence}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Days Since Report:</span>
                      <span className="font-medium">
                        {Math.floor(
                          (new Date().getTime() - new Date(update.dateReported).getTime()) / (1000 * 60 * 60 * 24),
                        )}{" "}
                        days
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Items ({update.evidenceItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {update.evidenceItems.map((evidence) => (
                    <div key={evidence.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{evidence.title}</h4>
                          <p className="text-sm text-gray-600">{evidence.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{evidence.type}</Badge>
                          {evidence.verified ? (
                            <Badge className="bg-green-100 text-green-800">Verified</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Submitted: {format(new Date(evidence.dateSubmitted), "MMM dd, yyyy")}</span>
                        <Button variant="ghost" size="sm">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Investigation Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {update.timeline.map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            item.status === "completed"
                              ? "bg-green-500"
                              : item.status === "in-progress"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                          }`}
                        />
                        {index < update.timeline.length - 1 && <div className="w-px h-12 bg-gray-200 mt-2" />}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{item.action}</h4>
                          <span className="text-sm text-gray-500">{format(new Date(item.date), "MMM dd, yyyy")}</span>
                        </div>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="related" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Related Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {update.relatedReports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{report.id}</h4>
                          <p className="text-sm text-gray-600">{report.issue}</p>
                          <p className="text-xs text-gray-500">
                            Reported: {format(new Date(report.dateReported), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                          <Link href={`/flagged-updates/${report.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
