import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-white border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="text-green-600 text-2xl font-bold">✱</div>
              <span className="text-xl font-bold text-gray-900">logo</span>
            </div>
            <p className="text-gray-600 text-sm">
              Empowering Kenyans through transparency and accountability in politics.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/search" className="hover:text-gray-900">
                  Search Politicians
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-gray-900">
                  Explore Directory
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-gray-900">
                  Alerts & Trends
                </Link>
              </li>
              <li>
                <Link href="/submit-report" className="hover:text-gray-900">
                  Submit Report
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/about" className="hover:text-gray-900">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="hover:text-gray-900">
                  Methodology
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-gray-900">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-gray-900">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/terms" className="hover:text-gray-900">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-gray-900">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-gray-900">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-gray-600">&copy; 2024 Kenya ni Yetu. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className="flex gap-4 text-gray-400">
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
