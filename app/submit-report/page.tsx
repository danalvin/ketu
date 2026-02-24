"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Upload } from "lucide-react"
import { listPoliticians, submitReport } from "@/lib/api"

interface PoliticianOption {
  id: string
  name: string
  position: string
}

export default function SubmitReportPage() {
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [selectedPolitician, setSelectedPolitician] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [incidentDate, setIncidentDate] = useState("")
  const [description, setDescription] = useState("")
  const [politicians, setPoliticians] = useState<PoliticianOption[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadPoliticians() {
      try {
        const response = await listPoliticians({ page: 1, page_size: 100, is_active: true })
        if (isMounted) {
          setPoliticians(
            response.items.map((item) => ({
              id: item.id,
              name: item.name,
              position: item.position,
            })),
          )
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
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (!selectedPolitician || !selectedCategory || !title.trim() || !description.trim()) {
      setError("Please complete politician, category, title, and description.")
      return
    }

    setIsSubmitting(true)
    try {
      await submitReport({
        politician_id: selectedPolitician,
        issue_type: selectedCategory,
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        incident_date: incidentDate || undefined,
        is_anonymous: isAnonymous,
      })

      setMessage("Report submitted successfully and is now under review.")
      setSelectedCategory("")
      setSelectedPolitician("")
      setTitle("")
      setLocation("")
      setIncidentDate("")
      setDescription("")
      setIsAnonymous(false)
    } catch {
      setError("Could not submit report. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
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
                      {politicians.map((politician) => (
                        <SelectItem key={politician.id} value={politician.id}>
                          {politician.name} ({politician.position})
                        </SelectItem>
                      ))}
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
                      <SelectItem value="misuse_of_public_funds">Misuse of Public Funds</SelectItem>
                      <SelectItem value="service_failure">Service Failure</SelectItem>
                      <SelectItem value="violence_or_intimidation">Violence/Intimidation</SelectItem>
                      <SelectItem value="electoral_malpractice">Electoral Malpractice</SelectItem>
                      <SelectItem value="conflict_of_interest">Conflict of Interest</SelectItem>
                      <SelectItem value="credential_misrepresentation">Credential Misrepresentation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Report Title</label>
                  <Input
                    placeholder="Short summary of the incident"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Incident Location (Optional)</label>
                    <Input placeholder="e.g. Nairobi" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Incident Date (Optional)</label>
                    <Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
                  </div>
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
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">File uploads will be enabled in the next phase.</p>
                    <p className="text-xs text-gray-500 mt-1">Current submission accepts text details only.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Submit Anonymously</label>
                    <p className="text-xs text-gray-500">Your identity will not be disclosed</p>
                  </div>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>

                {message ? <p className="text-sm text-green-700 bg-green-50 p-3 rounded-md">{message}</p> : null}
                {error ? <p className="text-sm text-red-700 bg-red-50 p-3 rounded-md">{error}</p> : null}

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => {
                      setSelectedCategory("")
                      setSelectedPolitician("")
                      setTitle("")
                      setLocation("")
                      setIncidentDate("")
                      setDescription("")
                      setIsAnonymous(false)
                      setMessage(null)
                      setError(null)
                    }}
                  >
                    Clear
                  </Button>
                  <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Report"}
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
