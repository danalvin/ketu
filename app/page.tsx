import { Suspense } from "react"
import HeroSection from "./components/hero-section"
import FeaturedPoliticians from "./components/featured-politicians"
import QuickStats from "./components/quick-stats"
import NewsTickerBanner from "./components/news-ticker-banner"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="h-16 bg-gray-200 animate-pulse" />}>
        <NewsTickerBanner />
      </Suspense>
      <HeroSection />
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <Suspense fallback={<div className="h-96 bg-gray-200 animate-pulse rounded-lg" />}>
              <FeaturedPoliticians />
            </Suspense>
          </div>
          <div className="lg:col-span-1">
            <Suspense fallback={<div className="h-96 bg-gray-200 animate-pulse rounded-lg" />}>
              <QuickStats />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
