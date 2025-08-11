"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ZoomIn, ZoomOut, RotateCcw, Download, Info } from "lucide-react"

interface Associate {
  id: string
  name: string
  position: string
  photo: string
}

interface HyperEdge {
  id: string
  label: string
  type: "committee" | "event" | "funding" | "family" | "business" | "party"
  members: string[]
  strength: number
  description: string
}

interface PoliticalLinkagesProps {
  associates: Associate[]
  politician?: {
    id: string
    name: string
    position: string
  }
}

export default function PoliticalLinkages({ associates, politician }: PoliticalLinkagesProps) {
  const cyRef = useRef<HTMLDivElement>(null)
  const [cy, setCy] = useState<any>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [layoutType, setLayoutType] = useState("cose")
  const [filterType, setFilterType] = useState("all")

  // Sample hypergraph data showing complex political relationships
  const hyperEdges: HyperEdge[] = [
    {
      id: "he1",
      label: "Budget Committee",
      type: "committee",
      members: [politician?.id || "main", "1", "2"], // Using actual associate IDs
      strength: 0.9,
      description: "Joint committee overseeing national budget allocation",
    },
    {
      id: "he2",
      label: "Healthcare Reform Coalition",
      type: "event",
      members: [politician?.id || "main", "1", "3"], // Using actual associate IDs
      strength: 0.8,
      description: "Cross-party coalition for healthcare policy reform",
    },
    {
      id: "he3",
      label: "Education Funding Initiative",
      type: "funding",
      members: [politician?.id || "main", "2", "3"], // Using actual associate IDs
      strength: 0.7,
      description: "Joint funding initiative for rural education programs",
    },
    {
      id: "he4",
      label: "Anti-Corruption Task Force",
      type: "committee",
      members: ["1", "2", "3"], // Using actual associate IDs
      strength: 0.85,
      description: "Multi-agency task force on corruption prevention",
    },
    {
      id: "he5",
      label: "Youth Empowerment Summit",
      type: "event",
      members: [politician?.id || "main", "1"], // Using actual associate IDs
      strength: 0.6,
      description: "Annual summit on youth empowerment policies",
    },
  ]

  const getTypeColor = (type: string) => {
    const colors = {
      committee: "#3B82F6", // blue
      event: "#10B981", // green
      funding: "#F59E0B", // amber
      family: "#EF4444", // red
      business: "#8B5CF6", // purple
      party: "#06B6D4", // cyan
    }
    return colors[type as keyof typeof colors] || "#6B7280"
  }

  // Update the useEffect to include proper error handling and ID validation
  useEffect(() => {
    if (!cyRef.current) return

    // Dynamically import Cytoscape to avoid SSR issues
    import("cytoscape").then((cytoscapeModule) => {
      const cytoscape = cytoscapeModule.default

      // Create a set of valid node IDs for validation
      const validNodeIds = new Set([politician?.id || "main", ...associates.map((a) => a.id)])

      // Create nodes for politicians
      const nodes = [
        {
          data: {
            id: politician?.id || "main",
            label: politician?.name || "Main Politician",
            type: "main",
            position: politician?.position || "Position",
          },
        },
        ...associates.map((associate) => ({
          data: {
            id: associate.id,
            label: associate.name,
            type: "associate",
            position: associate.position,
          },
        })),
      ]

      // Create hyperedge nodes and connecting edges with validation
      const hyperNodes: any[] = []
      const edges: any[] = []

      hyperEdges.forEach((hyperEdge) => {
        if (filterType === "all" || filterType === hyperEdge.type) {
          // Validate that all members exist before creating the hyperedge
          const validMembers = hyperEdge.members.filter((memberId) => validNodeIds.has(memberId))

          if (validMembers.length >= 2) {
            // Only create hyperedge if at least 2 valid members
            // Create a hyperedge node
            hyperNodes.push({
              data: {
                id: hyperEdge.id,
                label: hyperEdge.label,
                type: "hyperedge",
                edgeType: hyperEdge.type,
                strength: hyperEdge.strength,
                description: hyperEdge.description,
              },
            })

            // Connect each valid member to the hyperedge
            validMembers.forEach((memberId) => {
              edges.push({
                data: {
                  id: `${hyperEdge.id}-${memberId}`,
                  source: memberId,
                  target: hyperEdge.id,
                  strength: hyperEdge.strength,
                },
              })
            })
          }
        }
      })

      const cyInstance = cytoscape({
        container: cyRef.current,
        elements: [...nodes, ...hyperNodes, ...edges],
        style: [
          {
            selector: 'node[type="main"]',
            style: {
              "background-color": "#10B981",
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              color: "white",
              "font-size": "12px",
              "font-weight": "bold",
              width: "80px",
              height: "80px",
              "border-width": "3px",
              "border-color": "#059669",
              "text-wrap": "wrap",
              "text-max-width": "75px",
            },
          },
          {
            selector: 'node[type="associate"]',
            style: {
              "background-color": "#3B82F6",
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              color: "white",
              "font-size": "10px",
              width: "60px",
              height: "60px",
              "border-width": "2px",
              "border-color": "#2563EB",
              "text-wrap": "wrap",
              "text-max-width": "55px",
            },
          },
          {
            selector: 'node[type="hyperedge"]',
            style: {
              "background-color": (ele: any) => getTypeColor(ele.data("edgeType")),
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              color: "white",
              "font-size": "8px",
              "font-weight": "bold",
              width: "40px",
              height: "40px",
              shape: "diamond",
              "text-wrap": "wrap",
              "text-max-width": "35px",
            },
          },
          {
            selector: "edge",
            style: {
              width: (ele: any) => Math.max(1, ele.data("strength") * 4),
              "line-color": "#94A3B8",
              "target-arrow-color": "#94A3B8",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              opacity: 0.7,
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-width": "4px",
              "border-color": "#F59E0B",
            },
          },
        ],
        layout: {
          name: layoutType,
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 50,
        },
      })

      // Add event listeners
      cyInstance.on("tap", "node", (evt) => {
        const node = evt.target
        setSelectedNode(node.data())
      })

      setCy(cyInstance)

      return () => {
        cyInstance.destroy()
      }
    })
  }, [associates, politician, layoutType, filterType])

  const handleZoomIn = () => {
    if (cy) cy.zoom(cy.zoom() * 1.2)
  }

  const handleZoomOut = () => {
    if (cy) cy.zoom(cy.zoom() * 0.8)
  }

  const handleReset = () => {
    if (cy) {
      cy.fit()
      cy.zoom(1)
    }
  }

  const handleExport = () => {
    if (cy) {
      const png = cy.png({ scale: 2, full: true })
      const link = document.createElement("a")
      link.download = "political-network.png"
      link.href = png
      link.click()
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="hypergraph" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hypergraph">Network Hypergraph</TabsTrigger>
          <TabsTrigger value="associates">Key Associates</TabsTrigger>
        </TabsList>

        <TabsContent value="hypergraph" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Political Network Hypergraph
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter connections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Connections</SelectItem>
                      <SelectItem value="committee">Committees</SelectItem>
                      <SelectItem value="event">Events</SelectItem>
                      <SelectItem value="funding">Funding</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="party">Party</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={layoutType} onValueChange={setLayoutType}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cose">Force</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="concentric">Concentric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div ref={cyRef} className="w-full h-96 border rounded-lg bg-gray-50" style={{ minHeight: "400px" }} />

                {/* Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-sm border">
                  <h4 className="font-medium text-sm mb-2">Legend</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span>Main Politician</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>Associates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 transform rotate-45"></div>
                      <span>Committees</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 transform rotate-45"></div>
                      <span>Events</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 transform rotate-45"></div>
                      <span>Funding</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Node Details */}
              {selectedNode && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{selectedNode.label}</h4>
                  {selectedNode.type === "hyperedge" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: getTypeColor(selectedNode.edgeType) }}>
                          {selectedNode.edgeType}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Strength: {Math.round(selectedNode.strength * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{selectedNode.description}</p>
                    </div>
                  )}
                  {selectedNode.type !== "hyperedge" && (
                    <p className="text-sm text-gray-600">{selectedNode.position}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {
                    hyperEdges.filter((he) => {
                      const validNodeIds = new Set([politician?.id || "main", ...associates.map((a) => a.id)])
                      return he.members.filter((id) => validNodeIds.has(id)).length >= 2
                    }).length
                  }
                </div>
                <div className="text-sm text-gray-600">Active Connections</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {
                    hyperEdges.filter((he) => {
                      const validNodeIds = new Set([politician?.id || "main", ...associates.map((a) => a.id)])
                      return he.strength > 0.8 && he.members.filter((id) => validNodeIds.has(id)).length >= 2
                    }).length
                  }
                </div>
                <div className="text-sm text-gray-600">Strong Connections</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{associates.length + 1}</div>
                <div className="text-sm text-gray-600">Connected Politicians</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="associates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {associates.map((associate) => (
              <Card key={associate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src={associate.photo || "/placeholder.svg"}
                      alt={associate.name}
                      width={50}
                      height={50}
                      className="rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{associate.name}</h4>
                      <p className="text-sm text-gray-600">{associate.position}</p>

                      {/* Show connections for this associate */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {hyperEdges
                          .filter((he) => he.members.includes(associate.id))
                          .slice(0, 3)
                          .map((he) => (
                            <Badge
                              key={he.id}
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: getTypeColor(he.type) }}
                            >
                              {he.label}
                            </Badge>
                          ))}
                        {hyperEdges.filter((he) => he.members.includes(associate.id)).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{hyperEdges.filter((he) => he.members.includes(associate.id)).length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
