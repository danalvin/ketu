"use client"

import { useEffect, useState } from "react"

const newsItems = [
  "Investigation launched into Kisumu County land deals.",
  "New policy on youth empowerment passed by Parliament.",
  "Public forum on healthcare reforms scheduled for next week.",
  "Politician X responds to public criticism.",
]

export default function NewsTickerBanner() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-gray-100 py-2 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center text-sm text-gray-600">
          <span className="font-medium mr-4">Latest:</span>
          <div className="animate-pulse">{newsItems[currentIndex]}</div>
        </div>
      </div>
    </div>
  )
}
