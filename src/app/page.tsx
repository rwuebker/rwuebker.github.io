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
            <details className="relative">
              <summary className="list-none cursor-pointer hover:text-white transition [&::-webkit-details-marker]:hidden">
                Projects
              </summary>
              <div className="absolute right-0 mt-3 w-64 rounded-md border border-neutral-700 bg-neutral-900/95 p-2 shadow-lg">
                <a
                  href="/projects/dataset-interpreter"
                  className="block rounded px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white transition"
                >
                  Dataset Interpreter
                </a>
              </div>
            </details>

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

          <a
            href="/resume/resume.pdf"
            download
            className="inline-flex items-center px-7 py-3 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-100 transition"
            >
              Download Resume
            </a>

          <p className="mt-8 max-w-2xl text-sm text-neutral-400 leading-relaxed">
            Building applied AI systems that transform messy data into clear decisions, with a focus on reliable
            architecture and practical research workflows.
          </p>
        </section>

        {/* WHAT I'M BUILDING TOWARD */}
        <section className="mt-28 pb-20">
          <h2 className="text-lg font-semibold text-neutral-300 mb-10 tracking-wide">
            Interests:
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

          <div className="mt-14 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Featured Project</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Dataset Interpreter</h3>
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
              A production-style AI data understanding system designed for FDE interviews. It ingests unknown
              datasets, profiles quality, diagnoses issues, and generates grounded next-step guidance for ML.
            </p>
            <a
              href="/projects/dataset-interpreter"
              className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-100 transition"
            >
              View Project
            </a>
          </div>
        </section>

      </div>
    </main>
  );
}
