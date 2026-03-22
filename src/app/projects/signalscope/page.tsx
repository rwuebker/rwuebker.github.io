export default function SignalScope() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 pt-12 pb-20">

        {/* TITLE */}
        <h1 className="text-5xl font-semibold tracking-tight mb-6">
          SignalScope
        </h1>

        {/* OVERVIEW */}
        <p className="text-lg text-neutral-300 leading-relaxed max-w-3xl mb-16">
          SignalScope is an AI-assisted quantitative research platform designed to evaluate alpha signals
          and systematic investment factors. It combines statistical rigor with structured workflows
          to support repeatable, scalable signal analysis.
        </p>

        {/* WHAT IT DOES */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-neutral-300 mb-6 tracking-wide">
            What It Does
          </h2>

          <div className="space-y-4 text-neutral-400 max-w-3xl">
            <p>
              SignalScope provides a structured environment for evaluating predictive signals across
              time, cross-section, and quantile groupings.
            </p>
            <p>
              It enables researchers to move from raw factor definitions to statistically grounded insights,
              with consistent methodology and reproducible outputs.
            </p>
          </div>
        </section>

        {/* CORE CAPABILITIES */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-neutral-300 mb-6 tracking-wide">
            Core Capabilities
          </h2>

          <ul className="space-y-4 text-neutral-400 max-w-3xl">
            <li>
              • Information Coefficient (IC) and rank IC analysis
            </li>
            <li>
              • Quantile-based return evaluation
            </li>
            <li>
              • Factor decomposition and signal breakdown
            </li>
            <li>
              • Session-based research workflows
            </li>
            <li>
              • AI-assisted interpretation of signal behavior
            </li>
          </ul>
        </section>

        {/* WHY IT MATTERS */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-neutral-300 mb-6 tracking-wide">
            Why It Matters
          </h2>

          <div className="space-y-4 text-neutral-400 max-w-3xl">
            <p>
              Evaluating alpha signals is often fragmented and inconsistent across research environments.
              SignalScope aims to standardize this process into a repeatable framework.
            </p>
            <p>
              By combining structured analytics with AI-assisted interpretation, it reduces the friction
              between signal discovery and actionable insight.
            </p>
          </div>
        </section>

        {/* LINK */}
        <a
          href="https://github.com/rwuebker/signalscope"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-7 py-3 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-100 transition"
        >
          View on GitHub
        </a>

      </div>
    </main>
  );
}
