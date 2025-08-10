"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Upload } from "lucide-react"

export default function SubmitReportPage() {
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [selectedPolitician, setSelectedPolitician] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log({
      politician: selectedPolitician,
      category: selectedCategory,
      description,
      anonymous: isAnonymous,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Submit a New Report</h1>
            <p className="text-gray-600">
              Provide details about the incident you wish to report. Your contribution helps maintain transparency.
            </p>
          </div>

          <Card>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Politician Involved</label>
                  <Select value={selectedPolitician} onValueChange={setSelectedPolitician}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a politician" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="margaret-kenyatta">Hon. Margaret Kenyatta</SelectItem>
                      <SelectItem value="william-ruto">William Ruto</SelectItem>
                      <SelectItem value="raila-odinga">Raila Odinga</SelectItem>
                      <SelectItem value="martha-karua">Martha Karua</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category of Incident</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corruption">Corruption</SelectItem>
                      <SelectItem value="misuse-of-funds">Misuse of Public Funds</SelectItem>
                      <SelectItem value="service-failure">Service Failure</SelectItem>
                      <SelectItem value="violence">Violence/Intimidation</SelectItem>
                      <SelectItem value="electoral-malpractice">Electoral Malpractice</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
                  <Textarea
                    placeholder="Describe the incident, including dates, locations, and any relevant details."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Evidence Upload (Optional)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Choose file (PDF, image, video)</p>
                    <p className="text-xs text-gray-500 mt-1">Max file size: 10MB</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Submit Anonymously</label>
                    <p className="text-xs text-gray-500">Your identity will not be disclosed</p>
                  </div>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" className="flex-1 bg-transparent">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                    Submit Report
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
