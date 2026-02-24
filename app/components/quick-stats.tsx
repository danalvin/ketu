import { Card, CardContent } from "@/components/ui/card"
import { Users, FileText, Clock, Zap } from "lucide-react"
import { getOverviewStats } from "@/lib/api"

export default async function QuickStats() {
  let overview = null
  try {
    overview = await getOverviewStats()
  } catch {
    overview = null
  }

  const stats = [
    {
      icon: Users,
      label: "Total Politicians Tracked",
      value: overview ? String(overview.total_politicians) : "N/A",
      color: "text-green-600",
    },
    {
      icon: FileText,
      label: "Total Reports Submitted",
      value: overview ? String(overview.total_reports) : "N/A",
      color: "text-blue-600",
    },
    {
      icon: Clock,
      label: "Last Database Update",
      value: overview ? "Live" : "Unavailable",
      color: "text-gray-600",
    },
    {
      icon: Zap,
      label: "Average Transparency",
      value: overview ? `${Math.round(overview.average_transparency_score)}%` : "N/A",
      color: "text-yellow-600",
    },
  ]

  return (
    <section>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Quick Stats</h2>
      <div className="space-y-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full bg-gray-100 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-gray-600 text-sm">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
