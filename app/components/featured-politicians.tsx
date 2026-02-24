import Image from "next/image"
import Link from "next/link"
import { listPoliticians } from "@/lib/api"

export default async function FeaturedPoliticians() {
  let featuredPoliticians: Awaited<ReturnType<typeof listPoliticians>>["items"] = []
  try {
    const response = await listPoliticians({ page: 1, page_size: 6, is_active: true })
    featuredPoliticians = response.items
  } catch {
    featuredPoliticians = []
  }

  return (
    <section>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Featured Politicians</h2>
      {featuredPoliticians.length === 0 ? (
        <p className="text-gray-600">No featured politicians available yet.</p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuredPoliticians.map((politician) => (
          <Link key={politician.id} href={`/politician/${politician.id}`}>
            <div className="text-center group cursor-pointer">
              <div className="relative mb-4">
                <Image
                  src={politician.photo_url || "/placeholder.svg"}
                  alt={politician.name}
                  width={120}
                  height={120}
                  className="rounded-full mx-auto object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="font-semibold text-lg text-gray-900 mb-1">{politician.name}</h3>
              <p className="text-gray-600 text-sm mb-3">{politician.position}</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Approval Score: {Math.round(Number(politician.transparency_score))}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(Number(politician.transparency_score))}%` }}
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
