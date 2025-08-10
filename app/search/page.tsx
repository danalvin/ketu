"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import SearchBar from "../components/search-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

interface Politician {
  id: string
  name: string
  position: string
  party: string
  county: string
  overallScore: number
  photo: string
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [scoreRange, setScoreRange] = useState([0, 100])
  const [loading, setLoading] = useState(true)

  const mockResults: Politician[] = [
    {
      id: "1",
      name: "Martha Karua",
      position: "Former Minister of Justice",
      party: "NARC-Kenya",
      county: "Kirinyaga",
      overallScore: 85,
      photo: "/placeholder.svg?height=80&width=80&text=Martha+Karua",
    },
    {
      id: "2",
      name: "Raila Odinga",
      position: "Former Prime Minister",
      party: "ODM",
      county: "Kisumu",
      overallScore: 78,
      photo: "/placeholder.svg?height=80&width=80&text=Raila+Odinga",
    },
    {
      id: "3",
      name: "William Ruto",
      position: "President of Kenya",
      party: "UDA",
      county: "Uasin Gishu",
      overallScore: 70,
      photo: "/placeholder.svg?height=80&width=80&text=William+Ruto",
    },
    {
      id: "4",
      name: "Kalonzo Musyoka",
      position: "Former Vice President",
      party: "Wiper Democratic Movement",
      county: "Kitui",
      overallScore: 65,
      photo: "/placeholder.svg?height=80&width=80&text=Kalonzo+Musyoka",
    },
    {
      id: "5",
      name: "Musalia Mudavadi",
      position: "Prime Cabinet Secretary",
      party: "ANC",
      county: "Kakamega",
      overallScore: 72,
      photo: "/placeholder.svg?height=80&width=80&text=Musalia+Mudavadi",
    },
    {
      id: "6",
      name: "Anne Waiguru",
      position: "Governor of Kirinyaga",
      party: "UDA",
      county: "Kirinyaga",
      overallScore: 80,
      photo: "/placeholder.svg?height=80&width=80&text=Anne+Waiguru",
    },
    {
      id: "7",
      name: "Hassan Joho",
      position: "Former Governor of Mombasa",
      party: "ODM",
      county: "Mombasa",
      overallScore: 68,
      photo: "/placeholder.svg?height=80&width=80&text=Hassan+Joho",
    },
    {
      id: "8",
      name: "Johnson Sakaja",
      position: "Governor of Nairobi",
      party: "UDA",
      county: "Nairobi",
      overallScore: 75,
      photo: "/placeholder.svg?height=80&width=80&text=Johnson+Sakaja",
    },
  ]

  useEffect(() => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }, [query])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Results ({mockResults.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockResults.map((politician) => (
          <Link key={politician.id} href={`/politician/${politician.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Image
                    src={politician.photo || "/placeholder.svg"}
                    alt={politician.name}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">{politician.name}</h3>
                    <p className="text-gray-600">{politician.position}</p>
                    <p className="text-sm text-gray-500">{politician.county}</p>
                    <Badge
                      variant="outline"
                      className={`mt-2 ${
                        politician.party === "ODM"
                          ? "bg-blue-100 text-blue-800"
                          : politician.party === "UDA"
                            ? "bg-yellow-100 text-yellow-800"
                            : politician.party === "NARC-Kenya"
                              ? "bg-green-100 text-green-800"
                              : politician.party === "Wiper Democratic Movement"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {politician.party}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Overall Score:</span>
                    <span className="font-semibold">{politician.overallScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${politician.overallScore}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function SearchPage() {
  const [scoreRange, setScoreRange] = useState([0, 100])

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Party</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Parties</SelectItem>
                      <SelectItem value="odm">ODM</SelectItem>
                      <SelectItem value="uda">UDA</SelectItem>
                      <SelectItem value="narc">NARC-Kenya</SelectItem>
                      <SelectItem value="anc">ANC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by County</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Counties</SelectItem>
                      <SelectItem value="nairobi">Nairobi</SelectItem>
                      <SelectItem value="mombasa">Mombasa</SelectItem>
                      <SelectItem value="kisumu">Kisumu</SelectItem>
                      <SelectItem value="nakuru">Nakuru</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Position</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      <SelectItem value="president">President</SelectItem>
                      <SelectItem value="governor">Governor</SelectItem>
                      <SelectItem value="senator">Senator</SelectItem>
                      <SelectItem value="mp">MP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Score Range: {scoreRange[0]} - {scoreRange[1]}
                  </label>
                  <Slider value={scoreRange} onValueChange={setScoreRange} max={100} step={1} className="mb-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Confidence</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select confidence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="high">High (80%+)</SelectItem>
                      <SelectItem value="medium">Medium (60-79%)</SelectItem>
                      <SelectItem value="low">Low (&lt;60%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relevance</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="score">Score</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="updated">Last Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent">
                    Clear
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700">Apply Filters</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Suspense fallback={<div>Loading...</div>}>
              <SearchResults />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
