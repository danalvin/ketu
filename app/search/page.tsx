"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import SearchBar from "../components/search-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import Image from "next/image"
import Link from "next/link"
import { getStatsByCounty, getStatsByParty, listPoliticians, Politician } from "@/lib/api"

function SearchResults() {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get("q") || ""

  const [query, setQuery] = useState(queryFromUrl)
  const [party, setParty] = useState("all")
  const [county, setCounty] = useState("all")
  const [position, setPosition] = useState("all")
  const [scoreRange, setScoreRange] = useState([0, 100])
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<Politician[]>([])
  const [countyOptions, setCountyOptions] = useState<string[]>([])
  const [partyOptions, setPartyOptions] = useState<string[]>([])

  useEffect(() => {
    setQuery(queryFromUrl)
  }, [queryFromUrl])

  useEffect(() => {
    let isMounted = true

    async function loadResults() {
      setLoading(true)
      try {
        const response = await listPoliticians({
          page: 1,
          page_size: 50,
          search: query || undefined,
          party: party !== "all" ? party : undefined,
          county: county !== "all" ? county : undefined,
          position: position !== "all" ? position : undefined,
          min_score: scoreRange[0],
          max_score: scoreRange[1],
          is_active: true,
        })
        if (isMounted) {
          setResults(response.items)
        }
      } catch {
        if (isMounted) {
          setResults([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadResults()

    return () => {
      isMounted = false
    }
  }, [query, party, county, position, scoreRange])

  useEffect(() => {
    let isMounted = true

    async function loadFilters() {
      try {
        const [counties, parties] = await Promise.all([getStatsByCounty(), getStatsByParty()])
        if (!isMounted) return
        setCountyOptions(counties.map((item) => item.county).filter(Boolean).sort((a, b) => a.localeCompare(b)))
        setPartyOptions(parties.map((item) => item.party).filter(Boolean).sort((a, b) => a.localeCompare(b)))
      } catch {
        if (!isMounted) return
        setCountyOptions([])
        setPartyOptions([])
      }
    }

    void loadFilters()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Results ({results.length})</h2>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Party</label>
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger>
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                {partyOptions.map((partyOption) => (
                  <SelectItem key={partyOption} value={partyOption}>
                    {partyOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by County</label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger>
                <SelectValue placeholder="Select county" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                {countyOptions.map((countyOption) => (
                  <SelectItem key={countyOption} value={countyOption}>
                    {countyOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Position</label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="President">President</SelectItem>
                <SelectItem value="Governor">Governor</SelectItem>
                <SelectItem value="Senator">Senator</SelectItem>
                <SelectItem value="Member of Parliament">Member of Parliament</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Score Range: {scoreRange[0]} - {scoreRange[1]}
            </label>
            <Slider value={scoreRange} onValueChange={setScoreRange} max={100} step={1} className="mb-2" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((politician) => {
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
                        className="h-20 w-20 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">{politician.name}</h3>
                        <p className="text-gray-600">{politician.position}</p>
                        <p className="text-sm text-gray-500">{politician.county || "County not set"}</p>
                        {politician.constituency ? (
                          <p className="text-xs text-gray-500">{politician.constituency} Constituency</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-gray-100 text-gray-800">
                            {politician.party || "Independent"}
                          </Badge>
                          <Badge variant="outline" className={politician.is_alive ? "text-emerald-700" : "text-rose-700"}>
                            {politician.is_alive ? "Alive" : "Deceased"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Overall Score:</span>
                        <span className="font-semibold">{score}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm py-6">
        <div className="container mx-auto px-4">
          <SearchBar />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Politician Search & Results</h1>
          <p className="text-gray-600">
            Find detailed information about Kenyan politicians, their performance, and activities.
          </p>
        </div>

        <Suspense fallback={<div className="h-96 bg-gray-200 animate-pulse rounded-lg" />}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  )
}
