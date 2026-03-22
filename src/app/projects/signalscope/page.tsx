export default function SignalScope() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 py-16">

        {/* TITLE */}
        <h1 className="text-5xl font-semibold tracking-tight mb-6">
          SignalScope
        </h1>

        {/* DESCRIPTION */}
        <p className="text-neutral-300 text-lg leading-relaxed max-w-3xl mb-12">
          SignalScope is an AI-assisted quantitative research tool for evaluating{" "}
          <span className="text-white">alpha signals</span> and{" "}
          <span className="text-white">systematic investment factors</span>. It
          combines rigorous statistical analysis with{" "}
          <span className="text-white">AI-driven interpretation</span> to
          accelerate the research workflow for quantitative analysts and
          portfolio researchers.
        </p>

        {/* FEATURES */}
        <h2 className="text-lg font-semibold text-neutral-400 tracking-wide uppercase mb-4">
          Features
        </h2>

        <ul className="space-y-4 text-neutral-300 mb-14">
          {[
            "Information Coefficient (IC) and rank IC",
            "Quantile analysis",
            "Factor decomposition",
            "AI-assisted interpretation",
            "Session-based workflows",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* BUTTON */}
        <a
          href="https://github.com/rwuebker/signalscope"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit px-8 py-3 bg-white text-black font-medium tracking-wide rounded-md hover:bg-neutral-100 transition-all duration-200"
        >
          View on GitHub
        </a>
      </div>
    </main>
  );
}
