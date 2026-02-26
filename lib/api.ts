export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.TRANSPARENCY_API_URL ||
  "http://localhost:8000/api/v1"

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Politician {
  id: string
  name: string
  position: string
  party: string | null
  county: string | null
  constituency: string | null
  parliamentary_role: string | null
  parliamentary_profile_url: string | null
  parliamentary_profile: Record<string, unknown> | null
  photo_url: string | null
  bio: string | null
  history: string | null
  date_of_birth: string | null
  date_of_death: string | null
  transparency_score: number
  confidence_level: number
  is_active: boolean
  is_alive: boolean
  created_at: string
  updated_at: string
}

export interface PoliticianDetail extends Politician {
  cases_count: number
  promises_count: number
  linkages_count: number
  reports_count: number
}

export interface LegalCase {
  id: string
  politician_id: string
  case_number: string | null
  title: string
  court: string | null
  status: string
  date_filed: string | null
  date_resolved: string | null
  severity: string | null
  category: string | null
  description: string | null
  outcome: string | null
  source_urls: string[] | null
  impact_score: number | null
  created_at: string
  updated_at: string
}

export interface PromiseItem {
  id: string
  politician_id: string
  title: string
  description: string
  date_made: string
  deadline: string | null
  status: string
  category: string | null
  evidence: Record<string, unknown> | null
  fulfillment_percentage: number
  verification_sources: string[] | null
  impact_area: string | null
  created_at: string
  updated_at: string
}

export interface OverviewStats {
  total_politicians: number
  active_politicians: number
  inactive_politicians: number
  total_cases: number
  pending_cases: number
  resolved_cases: number
  total_promises: number
  fulfilled_promises: number
  broken_promises: number
  in_progress_promises: number
  total_reports: number
  verified_reports: number
  under_review_reports: number
  average_transparency_score: number
  highest_score: number
  lowest_score: number
  total_users: number
}

export interface PoliticianStatsItem {
  id: string
  name: string
  position: string
  party: string
  photo_url: string | null
  transparency_score: number
  cases_count: number
  promises_count: number
  reports_count: number
}

export interface TopPoliticiansResponse {
  highest_scored: PoliticianStatsItem[]
  lowest_scored: PoliticianStatsItem[]
}

export interface PartyStatsItem {
  party: string
  politician_count: number
  average_score: number
}

export interface CountyStatsItem {
  county: string
  politician_count: number
  average_score: number
}

export interface PublicReport {
  id: string
  politician_id: string
  politician_name: string
  politician_position: string | null
  politician_photo_url: string | null
  issue_type: string
  title: string
  description: string
  status: string
  priority: string
  location: string | null
  incident_date: string | null
  is_anonymous: boolean
  date_reported: string
  created_at: string
  updated_at: string
}

export interface PublicReportDetail extends PublicReport {
  evidence_files: Array<Record<string, unknown>> | null
  investigation_timeline: Array<Record<string, unknown>> | null
  resolution: string | null
}

export interface ReportCreatePayload {
  politician_id: string
  issue_type: string
  title: string
  description: string
  location?: string
  incident_date?: string
  evidence_files?: Array<Record<string, unknown>>
  is_anonymous?: boolean
}

type QueryParamValue = string | number | boolean | null | undefined

function buildQueryString(params?: Record<string, QueryParamValue>): string {
  if (!params) return ""

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    searchParams.set(key, String(value))
  }

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ""
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  params?: Record<string, QueryParamValue>
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}${buildQueryString(params)}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function listPoliticians(params?: {
  page?: number
  page_size?: number
  search?: string
  party?: string
  county?: string
  constituency?: string
  position?: string
  min_score?: number
  max_score?: number
  is_active?: boolean
}) {
  return apiRequest<PaginatedResponse<Politician>>("/politicians", undefined, params)
}

export async function getPolitician(politicianId: string) {
  return apiRequest<PoliticianDetail>(`/politicians/${politicianId}`)
}

export async function getPoliticianCases(politicianId: string, params?: { page?: number; page_size?: number }) {
  return apiRequest<PaginatedResponse<LegalCase>>(`/politicians/${politicianId}/cases`, undefined, params)
}

export async function getPoliticianPromises(politicianId: string, params?: { page?: number; page_size?: number }) {
  return apiRequest<PaginatedResponse<PromiseItem>>(`/politicians/${politicianId}/promises`, undefined, params)
}

export async function getOverviewStats() {
  return apiRequest<OverviewStats>("/stats/overview")
}

export async function getTopPoliticians(limit = 10) {
  return apiRequest<TopPoliticiansResponse>("/stats/top-politicians", undefined, { limit })
}

export async function getStatsByParty() {
  return apiRequest<PartyStatsItem[]>("/stats/by-party")
}

export async function getStatsByCounty() {
  return apiRequest<CountyStatsItem[]>("/stats/by-county")
}

export async function submitReport(payload: ReportCreatePayload) {
  return apiRequest<unknown>("/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function listPublicReports(params?: {
  page?: number
  page_size?: number
  q?: string
  politician_id?: string
  status?: string
  priority?: string
}) {
  return apiRequest<PaginatedResponse<PublicReport>>("/reports/public", undefined, params)
}

export async function getPublicReport(reportId: string) {
  return apiRequest<PublicReportDetail>(`/reports/public/${reportId}`)
}
