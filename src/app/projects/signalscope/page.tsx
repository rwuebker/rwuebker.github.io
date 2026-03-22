export default function SignalScope() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold mb-6">SignalScope</h1>

        <p className="text-neutral-400 text-lg leading-relaxed mb-10">
          SignalScope is an AI-assisted quantitative research tool for evaluating
          alpha signals and systematic investment factors. It combines rigorous
          statistical analysis with AI-driven interpretation to accelerate the
          research workflow for quantitative analysts and portfolio researchers.
        </p>

        <h2 className="text-xl font-semibold mb-4">Features</h2>
        <ul className="space-y-3 text-neutral-300 mb-12">
          <li className="flex items-start gap-3">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
            Information Coefficient (IC) and rank IC
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
            Quantile analysis
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
            Factor decomposition
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
            AI-assisted interpretation
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
            Session-based workflows
          </li>
        </ul>

        <a
          href="https://github.com/rwuebker/signalscope"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-white text-black font-medium rounded hover:bg-neutral-200 transition"
        >
          View on GitHub
        </a>
      </div>
    </main>
  );
}
