import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white flex flex-col">
      {/* NAVBAR */}
      <nav className="w-full px-8 py-5 flex justify-between items-center border-b border-neutral-700">
        <span className="text-sm font-medium tracking-wide text-neutral-300 hover:text-neutral-100 transition-colors duration-200">
          Richard Wuebker
        </span>

        <div className="flex gap-8 text-sm text-neutral-400">
          {/* Projects dropdown */}
          <div className="relative group">
            <button className="hover:text-neutral-100 transition-colors duration-200 cursor-pointer tracking-wide">
              Projects
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <Link
                href="/projects/signalscope"
                className="block px-4 py-3 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 rounded-lg transition-colors duration-150"
              >
                SignalScope
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex-1 flex items-start justify-center px-8 pt-28 pb-20">
        <div className="flex flex-col gap-6 max-w-3xl w-full">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
            Portfolio
          </p>

          <h1 className="text-5xl md:text-6xl font-semibold leading-tight tracking-tight text-neutral-50">
            Quantitative Developer<br />& Systematic Researcher
          </h1>

          <p className="text-lg text-neutral-300 leading-relaxed">
            Building{" "}
            <span className="text-white">systematic investment frameworks</span>,{" "}
            <span className="text-white">signal evaluation systems</span>, and{" "}
            <span className="text-white">AI-assisted research tools</span>.
          </p>

          <div className="mt-10">
            <a
              href="/resume/resume.pdf"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-100 text-neutral-900 text-sm font-medium rounded-md shadow-md border border-neutral-200 hover:bg-neutral-100 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
            >
              Download Resume
            </a>
          </div>

          <div className="border-t border-neutral-800 mt-20 pt-10" />
        </div>
      </section>
    </main>
  );
}
