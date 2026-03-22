import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center">
      {/* NAVBAR */}
      <nav className="w-full max-w-4xl px-6 py-5 flex justify-between items-center border-b border-neutral-800">
        <span className="text-sm font-medium tracking-wide text-neutral-300 hover:text-neutral-100 transition-colors duration-200">
          Richard Wuebker
        </span>

        <div className="flex gap-8 text-sm text-neutral-400">
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
      <section className="w-full max-w-4xl px-6 min-h-[80vh] flex items-center">
        <div className="flex flex-col gap-6 mt-16">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
            Portfolio
          </p>

          <h1 className="text-5xl md:text-6xl font-semibold leading-tight tracking-tight text-white">
            Quantitative Developer &amp;<br />Systematic Researcher
          </h1>

          <p className="text-lg text-neutral-300 leading-relaxed max-w-xl">
            Building{" "}
            <span className="text-white">systematic investment frameworks</span>,{" "}
            <span className="text-white">signal evaluation systems</span>, and{" "}
            <span className="text-white">AI-assisted research tools</span>.
          </p>

          <a
            href="/resume/resume.pdf"
            download
            className="inline-flex w-fit items-center px-8 py-3 bg-white text-black text-sm font-medium tracking-wide rounded-md hover:bg-neutral-100 transition-all duration-200"
          >
            Download Resume
          </a>
        </div>
      </section>
    </main>
  );
}
