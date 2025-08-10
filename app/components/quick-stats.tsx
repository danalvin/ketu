import { Card, CardContent } from "@/components/ui/card"
import { Users, FileText, Clock, Zap } from "lucide-react"

export default function QuickStats() {
  const stats = [
    {
      icon: Users,
      label: "Total Politicians Tracked",
      value: "2,567",
      color: "text-green-600",
    },
    {
      icon: FileText,
      label: "Total Reports Submitted",
      value: "12,890",
      color: "text-blue-600",
    },
    {
      icon: Clock,
      label: "Last Database Update",
      value: "2 hours ago",
      color: "text-gray-600",
    },
    {
      icon: Zap,
      label: "New Insights Daily",
      value: "AI-Powered",
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
