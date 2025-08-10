import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"

interface Associate {
  id: string
  name: string
  position: string
  photo: string
}

interface PoliticalLinkagesProps {
  associates: Associate[]
}

export default function PoliticalLinkages({ associates }: PoliticalLinkagesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Network Visualization Placeholder */}
      <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center min-h-[300px]">
        <div className="text-center text-gray-500">
          <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4"></div>
          <p className="text-sm">Interactive Network Graph</p>
          <p className="text-xs mt-1">Political connections visualization</p>
        </div>
      </div>

      {/* Key Associates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Associates</h3>
        <div className="space-y-4">
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
                  <div>
                    <h4 className="font-medium text-gray-900">{associate.name}</h4>
                    <p className="text-sm text-gray-600">{associate.position}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
