import SearchBar from "./search-bar"

export default function HeroSection() {
  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">Empowering Kenyans Through Transparency</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Access unbiased information on politicians' performance, legal records, and public sentiment.
          <br />
          Hold your leaders accountable.
        </p>
        <div className="max-w-2xl mx-auto">
          <SearchBar />
        </div>
      </div>
    </section>
  )
}
