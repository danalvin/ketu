import Image from "next/image"
import Link from "next/link"

interface Politician {
  id: string
  name: string
  position: string
  photo: string
  approvalScore: number
}

export default function FeaturedPoliticians() {
  const featuredPoliticians: Politician[] = [
    {
      id: "1",
      name: "Hon. Sarah Odinga",
      position: "Member of Parliament",
      photo: "/placeholder.svg?height=120&width=120&text=Sarah+Odinga",
      approvalScore: 85,
    },
    {
      id: "2",
      name: "Dr. Ken Omondi",
      position: "Senator, Kisumu County",
      photo: "/placeholder.svg?height=120&width=120&text=Ken+Omondi",
      approvalScore: 78,
    },
    {
      id: "3",
      name: "Chief Alex Kimani",
      position: "Governor, Nairobi County",
      photo: "/placeholder.svg?height=120&width=120&text=Alex+Kimani",
      approvalScore: 91,
    },
    {
      id: "4",
      name: "Hon. Grace Nyambura",
      position: "Women Representative",
      photo: "/placeholder.svg?height=120&width=120&text=Grace+Nyambura",
      approvalScore: 72,
    },
    {
      id: "5",
      name: "Mr. David Mutiso",
      position: "County Assembly Member",
      photo: "/placeholder.svg?height=120&width=120&text=David+Mutiso",
      approvalScore: 65,
    },
    {
      id: "6",
      name: "Mrs. Esther Wanjiku",
      position: "Cabinet Secretary",
      photo: "/placeholder.svg?height=120&width=120&text=Esther+Wanjiku",
      approvalScore: 88,
    },
  ]

  return (
    <section>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Featured Politicians</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuredPoliticians.map((politician) => (
          <Link key={politician.id} href={`/politician/${politician.id}`}>
            <div className="text-center group cursor-pointer">
              <div className="relative mb-4">
                <Image
                  src={politician.photo || "/placeholder.svg"}
                  alt={politician.name}
                  width={120}
                  height={120}
                  className="rounded-full mx-auto object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="font-semibold text-lg text-gray-900 mb-1">{politician.name}</h3>
              <p className="text-gray-600 text-sm mb-3">{politician.position}</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Approval Score: {politician.approvalScore}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${politician.approvalScore}%` }}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
