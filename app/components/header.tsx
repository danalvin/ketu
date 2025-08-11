import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Menu } from "lucide-react"

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="text-green-600 text-2xl font-bold">✱</div>
            <span className="text-xl font-bold text-gray-900">logo</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">
              Home
            </Link>
            <Link href="/explore" className="text-gray-600 hover:text-gray-900 font-medium">
              Explore
            </Link>
            <Link href="/alerts" className="text-gray-600 hover:text-gray-900 font-medium">
              Alerts & Trends
            </Link>
            <Link href="/flagged-updates" className="text-gray-600 hover:text-gray-900 font-medium">
              Flagged Updates
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input type="text" placeholder="Search for politicians..." className="pl-10 w-64" />
              </div>
            </div>

            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              Login
            </Button>
            <Button className="bg-green-600 hover:bg-green-700">Submit Report</Button>

            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
