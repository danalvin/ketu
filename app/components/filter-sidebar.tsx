"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export default function FilterSidebar() {
  const [scoreRange, setScoreRange] = useState([0, 100])
  const [confidenceRange, setConfidenceRange] = useState([0, 100])

  const parties = ["UDA", "ODM", "NARC-Kenya", "ANC", "Wiper", "Other"]
  const positions = ["President", "Governor", "Senator", "MP", "MCA", "Other"]
  const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Other"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Party</h4>
          <div className="space-y-2">
            {parties.map((party) => (
              <div key={party} className="flex items-center space-x-2">
                <Checkbox id={party} />
                <label htmlFor={party} className="text-sm">
                  {party}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">Position</h4>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position} value={position}>
                  {position}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <h4 className="font-medium mb-3">County</h4>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select county" />
            </SelectTrigger>
            <SelectContent>
              {counties.map((county) => (
                <SelectItem key={county} value={county}>
                  {county}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <h4 className="font-medium mb-3">Transparency Score</h4>
          <div className="px-2">
            <Slider value={scoreRange} onValueChange={setScoreRange} max={100} step={1} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>{scoreRange[0]}</span>
              <span>{scoreRange[1]}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">Confidence Level</h4>
          <div className="px-2">
            <Slider value={confidenceRange} onValueChange={setConfidenceRange} max={100} step={1} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>{confidenceRange[0]}%</span>
              <span>{confidenceRange[1]}%</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button className="w-full">Apply Filters</Button>
          <Button variant="outline" className="w-full bg-transparent">
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
