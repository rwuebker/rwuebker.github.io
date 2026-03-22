import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 pt-12">

        {/* NAVBAR */}
        <nav className="flex justify-between items-center py-5 border-b border-neutral-700">
          <span className="text-sm font-medium tracking-wide text-neutral-300">
            Richard Wuebker
          </span>

          <div className="flex items-center gap-6 text-sm text-neutral-400">
            <div className="relative group">
              <button className="hover:text-white transition cursor-pointer">
                Projects
              </button>

              <div className="absolute right-0 top-full mt-2 w-44 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                <Link
                  href="/projects/signalscope"
                  className="block px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  SignalScope
                </Link>
              </div>
            </div>

            <a
              href="https://linkedin.com/in/rickwuebker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              LinkedIn
            </a>

            <a
              href="mailto:rlwuebker@gmail.com"
              className="hover:text-white transition"
            >
              Email
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="mt-20">
          <h1 className="text-5xl md:text-6xl font-semibold leading-tight tracking-tight mb-6 max-w-3xl">
            Quantitative Developer & Systematic Researcher
          </h1>

          <p className="text-lg text-neutral-300 max-w-2xl mb-8 leading-relaxed">
            Building systematic investment frameworks, signal evaluation systems,
            and AI-assisted research tools.
          </p>

          <a
            href="/resume/resume.pdf"
            download
            className="inline-flex items-center px-7 py-3 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-100 transition"
          >
            Download Resume
          </a>
        </section>

        {/* WHAT I'M BUILDING TOWARD */}
        <section className="mt-28 pb-20">
          <h2 className="text-lg font-semibold text-neutral-300 mb-10 tracking-wide">
            What I&apos;m Building Toward
          </h2>

          <div className="space-y-8 max-w-2xl">
            <div>
              <p className="text-sm font-medium text-white mb-1">
                Systematic Strategies
              </p>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Developing frameworks for designing and evaluating quantitative investment signals and factor models.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-1">
                Research Infrastructure
              </p>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Building tools to structure, test, and scale signal-based research workflows.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-1">
                AI-Assisted Analysis
              </p>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Exploring how AI can accelerate interpretation, insight generation, and decision-making in quantitative research.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
