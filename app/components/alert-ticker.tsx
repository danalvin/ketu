"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, TrendingUp } from "lucide-react"

interface Alert {
  id: string
  message: string
  type: "warning" | "info" | "urgent"
  timestamp: string
}

export default function AlertTicker() {
  const [alerts] = useState<Alert[]>([
    { id: "1", message: "New corruption case filed against MP John Doe", type: "warning", timestamp: "2 hours ago" },
    { id: "2", message: "Governor Jane Smith transparency score updated", type: "info", timestamp: "4 hours ago" },
    { id: "3", message: "URGENT: Ethics committee investigation launched", type: "urgent", timestamp: "1 hour ago" },
  ])

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [alerts.length])

  if (alerts.length === 0) return null

  const currentAlert = alerts[currentIndex]

  return (
    <div className="bg-red-600 text-white py-3 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 animate-pulse">
          {currentAlert.type === "urgent" ? (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <TrendingUp className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <span className="font-medium">{currentAlert.message}</span>
            <span className="ml-3 text-red-200 text-sm">• {currentAlert.timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
