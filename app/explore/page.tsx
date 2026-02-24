"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Grid, List, Map } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { listPoliticians, Politician } from "@/lib/api"

export default function ExplorePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [countyFilter, setCountyFilter] = useState("all")
  const [partyFilter, setPartyFilter] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [politicians, setPoliticians] = useState<Politician[]>([])

  useEffect(() => {
    let isMounted = true

    async function loadPoliticians() {
      try {
        const response = await listPoliticians({
          page: currentPage,
          page_size: 24,
          county: countyFilter !== "all" ? countyFilter : undefined,
          party: partyFilter !== "all" ? partyFilter : undefined,
          is_active: true,
        })

        if (isMounted) {
          setPoliticians(response.items)
        }
      } catch {
        if (isMounted) {
          setPoliticians([])
        }
      }
    }

    void loadPoliticians()
    return () => {
      isMounted = false
    }
  }, [currentPage, countyFilter, partyFilter])

  const sortedPoliticians = useMemo(() => {
    const items = [...politicians]
    if (sortBy === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "party") {
      items.sort((a, b) => (a.party || "").localeCompare(b.party || ""))
    } else if (sortBy === "county") {
      items.sort((a, b) => (a.county || "").localeCompare(b.county || ""))
    } else {
      items.sort((a, b) => Number(b.transparency_score) - Number(a.transparency_score))
    }
    return items
  }, [politicians, sortBy])

  const countyOptions = Array.from(new Set(politicians.map((p) => p.county).filter(Boolean) as string[])).sort()
  const partyOptions = Array.from(new Set(politicians.map((p) => p.party).filter(Boolean) as string[])).sort()

  const renderPoliticianCard = (politician: Politician) => {
    const score = Math.round(Number(politician.transparency_score))
    return (
      <Link key={politician.id} href={`/politician/${politician.id}`}>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Image
                src={politician.photo_url || "/placeholder.svg"}
                alt={politician.name}
                width={80}
                height={80}
                className="rounded-full object-cover"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">{politician.name}</h3>
                <p className="text-gray-600">{politician.position}</p>
                <p className="text-sm text-gray-500">{politician.county || "County unavailable"}</p>
                <Badge className="mt-2 bg-gray-100 text-gray-800">{politician.party || "Independent"}</Badge>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{score}</div>
                <div className="text-sm text-gray-500">Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Explore Politicians</h1>

          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="flex items-center gap-2"
              >
                <Grid className="h-4 w-4" />
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="flex items-center gap-2"
              >
                <Map className="h-4 w-4" />
                Map
              </Button>
            </div>

            <div className="flex gap-4">
              <Select value={countyFilter} onValueChange={setCountyFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by County" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  {countyOptions.map((county) => (
                    <SelectItem key={county} value={county}>
                      {county}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={partyFilter} onValueChange={setPartyFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  {partyOptions.map((party) => (
                    <SelectItem key={party} value={party}>
                      {party}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="county">County</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {viewMode === "map" ? (
          <Card className="h-96">
            <CardContent className="p-8 flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Map className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Map View</p>
                <p className="text-sm">Interactive county map is planned for the next phase.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
            {sortedPoliticians.map(renderPoliticianCard)}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" className="bg-green-600 text-white hover:bg-green-700">
            {currentPage}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
