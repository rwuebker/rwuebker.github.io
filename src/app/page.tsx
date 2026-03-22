import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* NAVBAR */}
      <nav className="w-full px-6 py-4 flex justify-between items-center border-b border-neutral-800">
        <h1 className="text-lg font-semibold">Richard Wuebker</h1>

        <div className="flex gap-6 text-sm text-neutral-300">
          {/* Projects dropdown */}
          <div className="relative group">
            <button className="hover:text-white transition-colors cursor-pointer">
              Projects
            </button>
            <div className="absolute right-0 top-full mt-2 w-44 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <Link
                href="/projects/signalscope"
                className="block px-4 py-2.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
              >
                SignalScope
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-4">
          Quantitative Developer & Systematic Researcher
        </h2>

        <p className="text-neutral-400 text-lg leading-relaxed">
          Building systematic investment frameworks, signal evaluation systems,
          and AI-assisted research tools.
        </p>

        {/* Download button placeholder */}
        <a
          href="/resume/resume.pdf"
          download
          className="inline-block mt-8 px-6 py-3 bg-white text-black font-medium rounded hover:bg-neutral-200 transition"
        >
          Download Resume
        </a>
      </section>
    </main>
  );
}
