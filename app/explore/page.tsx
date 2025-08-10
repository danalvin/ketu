"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Grid, List, Map } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface Politician {
  id: string
  name: string
  position: string
  party: string
  county: string
  score: number
  photo: string
}

export default function ExplorePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid")
  const [currentPage, setCurrentPage] = useState(1)

  const politicians: Politician[] = [
    {
      id: "1",
      name: "Hon. Sarah Wanjiku",
      position: "Member of Parliament",
      party: "Unity Alliance Party",
      county: "Nairobi County",
      score: 85,
      photo: "/placeholder.svg?height=80&width=80&text=Sarah+Wanjiku",
    },
    {
      id: "2",
      name: "Mr. David Kimani",
      position: "County Governor",
      party: "Democratic Reform Party",
      county: "Nakuru County",
      score: 78,
      photo: "/placeholder.svg?height=80&width=80&text=David+Kimani",
    },
    {
      id: "3",
      name: "Dr. Aisha Hassan",
      position: "Senator",
      party: "Progressive Vision Movement",
      county: "Mombasa County",
      score: 92,
      photo: "/placeholder.svg?height=80&width=80&text=Aisha+Hassan",
    },
    {
      id: "4",
      name: "Eng. John Otieno",
      position: "County Assembly Member",
      party: "People's Justice Party",
      county: "Kisumu County",
      score: 65,
      photo: "/placeholder.svg?height=80&width=80&text=John+Otieno",
    },
    {
      id: "5",
      name: "Madam Grace Nyambura",
      position: "Women Representative",
      party: "United Citizens Front",
      county: "Mombasa County",
      score: 88,
      photo: "/placeholder.svg?height=80&width=80&text=Grace+Nyambura",
    },
    {
      id: "6",
      name: "Chief Alex Kipkemboi",
      position: "Chief Administrative Secretary",
      party: "National Development Party",
      county: "Kericho County",
      score: 70,
      photo: "/placeholder.svg?height=80&width=80&text=Alex+Kipkemboi",
    },
    {
      id: "7",
      name: "Ms. Amina Rashid",
      position: "Cabinet Secretary",
      party: "Front for Change",
      county: "Garissa County",
      score: 95,
      photo: "/placeholder.svg?height=80&width=80&text=Amina+Rashid",
    },
    {
      id: "8",
      name: "Mr. Peter Kamau",
      position: "Principal Secretary",
      party: "Justice & Equity Party",
      county: "Murang'a County",
      score: 72,
      photo: "/placeholder.svg?height=80&width=80&text=Peter+Kamau",
    },
  ]

  const getPartyColor = (party: string) => {
    const colors: { [key: string]: string } = {
      "Unity Alliance Party": "bg-red-100 text-red-800",
      "Democratic Reform Party": "bg-blue-100 text-blue-800",
      "Progressive Vision Movement": "bg-green-100 text-green-800",
      "People's Justice Party": "bg-purple-100 text-purple-800",
      "United Citizens Front": "bg-yellow-100 text-yellow-800",
      "National Development Party": "bg-indigo-100 text-indigo-800",
      "Front for Change": "bg-pink-100 text-pink-800",
      "Justice & Equity Party": "bg-teal-100 text-teal-800",
    }
    return colors[party] || "bg-gray-100 text-gray-800"
  }

  const renderPoliticianCard = (politician: Politician) => (
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
              <Badge className={`mt-2 ${getPartyColor(politician.party)}`}>{politician.party}</Badge>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{politician.score}</div>
              <div className="text-sm text-gray-500">Score</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

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
              <Select>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by County" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  <SelectItem value="nairobi">Nairobi</SelectItem>
                  <SelectItem value="mombasa">Mombasa</SelectItem>
                  <SelectItem value="kisumu">Kisumu</SelectItem>
                  <SelectItem value="nakuru">Nakuru</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  <SelectItem value="unity">Unity Alliance Party</SelectItem>
                  <SelectItem value="democratic">Democratic Reform Party</SelectItem>
                  <SelectItem value="progressive">Progressive Vision Movement</SelectItem>
                </SelectContent>
              </Select>

              <Select>
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
                <p className="text-sm">Interactive map showing politicians by county</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
            {politicians.map(renderPoliticianCard)}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" className="bg-green-600 text-white">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
