import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, User, FileText, AlertTriangle, Clock, CheckCircle, Eye } from "lucide-react"
import { format } from "date-fns"
import { getPublicReport, listPublicReports } from "@/lib/api"

interface FlaggedUpdateDetailProps {
  params: {
    id: string
  }
}

function toLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getStatusIcon(status: string) {
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

function getStatusColor(status: string) {
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

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
    case "high":
      return "bg-red-100 text-red-800"
    case "medium":
      return "bg-yellow-100 text-yellow-800"
    case "low":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default async function FlaggedUpdateDetail({ params }: FlaggedUpdateDetailProps) {
  let update

  try {
    update = await getPublicReport(params.id)
  } catch {
    notFound()
  }

  let relatedReports = []
  try {
    const related = await listPublicReports({
      page: 1,
      page_size: 5,
      politician_id: update.politician_id,
    })
    relatedReports = related.items.filter((item) => item.id !== update.id).slice(0, 3)
  } catch {
    relatedReports = []
  }

  const timeline = Array.isArray(update.investigation_timeline) ? update.investigation_timeline : []
  const evidence = Array.isArray(update.evidence_files) ? update.evidence_files : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
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
                  src={update.politician_photo_url || "/placeholder.svg"}
                  alt={update.politician_name}
                  width={120}
                  height={120}
                  className="rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{update.id.slice(0, 8)}</h1>
                    <Badge className={getStatusColor(update.status)}>
                      {getStatusIcon(update.status)}
                      <span className="ml-1">{toLabel(update.status)}</span>
                    </Badge>
                    <Badge className={getPriorityColor(update.priority)}>{toLabel(update.priority)} Priority</Badge>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{update.title}</h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <Link href={`/politician/${update.politician_id}`} className="hover:text-blue-600">
                        {update.politician_name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Reported on {format(new Date(update.date_reported), "MMMM dd, yyyy")}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {evidence.length} evidence items
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:ml-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Issue Type:</span>
                    <div className="font-medium">{toLabel(update.issue_type)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Reported By:</span>
                    <div className="font-medium">{update.is_anonymous ? "Anonymous" : "Authenticated User"}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Updated:</span>
                    <div className="font-medium">{format(new Date(update.updated_at), "MMM dd, yyyy")}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Position:</span>
                    <div className="font-medium">{update.politician_position || "Unavailable"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                <p className="text-gray-700 leading-relaxed">{update.description}</p>
                {update.location ? <p className="text-sm text-gray-500 mt-4">Location: {update.location}</p> : null}
                {update.incident_date ? (
                  <p className="text-sm text-gray-500">Incident date: {format(new Date(update.incident_date), "MMMM dd, yyyy")}</p>
                ) : null}
                {update.resolution ? (
                  <div className="mt-4 p-3 bg-green-50 rounded-md text-sm text-green-800">Resolution: {update.resolution}</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidence.length === 0 ? <p className="text-gray-600">No evidence files attached.</p> : null}
                {evidence.map((item, idx) => (
                  <div key={idx} className="border rounded-md p-3">
                    <p className="font-medium text-gray-900">{String(item.title || `Evidence #${idx + 1}`)}</p>
                    <p className="text-sm text-gray-600">{String(item.description || "No description")}</p>
                    {item.type ? <p className="text-xs text-gray-500 mt-1">Type: {String(item.type)}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Investigation Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeline.length === 0 ? <p className="text-gray-600">No timeline entries available.</p> : null}
                {timeline.map((entry, idx) => (
                  <div key={idx} className="border-l-2 border-gray-300 pl-4">
                    <p className="font-medium text-gray-900">{String(entry.action || `Timeline entry #${idx + 1}`)}</p>
                    <p className="text-sm text-gray-600">{String(entry.description || "No description")}</p>
                    {entry.date ? <p className="text-xs text-gray-500 mt-1">{String(entry.date)}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="related">
            <Card>
              <CardHeader>
                <CardTitle>Related Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedReports.length === 0 ? <p className="text-gray-600">No related reports found.</p> : null}
                {relatedReports.map((report) => (
                  <div key={report.id} className="border rounded-md p-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{report.title}</p>
                      <p className="text-sm text-gray-600">{toLabel(report.status)}</p>
                    </div>
                    <Link href={`/flagged-updates/${report.id}`}>
                      <Button variant="outline" size="sm" className="bg-transparent">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
