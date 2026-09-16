import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Predicting the Left Tail | Richard Wuebker",
  description:
    "Can GARCH and machine learning warn us about downside risk? A research project studying five-day downside variance in SPY.",
};

const phases = [
  ["01", "GARCH foundations", "Explain and fit ARCH, GARCH, GARCH with Student-t errors, and GJR-GARCH with Student-t errors. Compare their responses to equal positive and negative shocks."],
  ["02", "Define the forecasting target", "Build forward downside-variance targets and establish chronological evaluation. Explain how a total-variance forecast relates to downside risk."],
  ["03", "Conventional machine learning", "Test one modest XGBoost model using observed returns, recent risk measures, drawdown, and available volatility-index data."],
  ["04", "A small LSTM", "Test a small neural network that reads sequences of daily observations. Report model size and explain why overlapping sequences are not independent histories."],
  ["05", "Hybrid models", "After testing each machine-learning model on its own, add GJR-GARCH forecasts to test whether they supply useful additional information."],
  ["06", "Model comparison", "Compare models with a historical downside-risk baseline on the same future dates. Check forecast errors and whether higher predicted risk corresponds to higher realized risk."],
  ["07", "Publish the first draft", "Report what worked, what failed, sample-size limitations, and the steps needed to reproduce the results."],
];

export default function LeftTailVolatilityPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
        <nav aria-label="Project navigation" className="flex items-center justify-between border-b border-neutral-800 pb-6 text-sm text-neutral-400">
          <Link href="/" className="hover:text-white transition">Richard Wuebker</Link>
          <Link href="/projects" className="hover:text-white transition">All Projects →</Link>
        </nav>

        <header className="mt-16 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Quantitative Research · In Progress</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Predicting the Left Tail</h1>
          <p className="mt-5 text-xl leading-relaxed text-neutral-200 sm:text-2xl">Can GARCH and Machine Learning Warn Us About Downside Risk?</p>
          <p className="mt-6 leading-relaxed text-neutral-400">
            The left tail is the negative end of a return distribution: the region containing losses.
            This project asks whether information available today can predict unusually high downside
            volatility in the S&amp;P 500 over the next five trading days, using SPY, an exchange-traded
            fund that tracks the index.
          </p>
        </header>

        <section aria-labelledby="target" className="mt-12 rounded-xl border border-emerald-900 bg-neutral-900/50 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">The Primary Target</p>
          <h2 id="target" className="mt-3 text-2xl font-semibold">How much negative price movement comes next?</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-neutral-300">
            Future five-day downside realized variance adds up the squared daily returns only on days
            when prices fall, from tomorrow through the fifth trading day. Squaring gives larger moves
            more weight. We also calculate total realized variance, which includes positive and negative days.
          </p>
          <p className="mt-5 rounded-lg bg-neutral-950 p-4 font-mono text-sm leading-relaxed text-emerald-200">
            DSV(t, t+5) = sum of r² for negative returns on days t+1 through t+5
          </p>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            This is a measure of the size of negative movements, not the probability of a crash or the
            cumulative five-day loss. Variance is measured in squared-return units; its square root is volatility.
          </p>
        </section>

        <section aria-labelledby="foundations" className="mt-14 max-w-3xl">
          <h2 id="foundations" className="text-2xl font-semibold">Starting with the models</h2>
          <div className="mt-5 space-y-4 leading-relaxed text-neutral-300">
            <p>ARCH estimates changing variance from recent squared shocks: surprises in returns. GARCH also carries forward the previous variance estimate, allowing risk to persist over time.</p>
            <p>Ordinary GARCH treats equal positive and negative shocks symmetrically: (+4%)² = (−4%)². GJR-GARCH adds a term for negative shocks so their effect can differ. Student-t errors allow more extreme surprises than a normal distribution.</p>
            <p>The first phase will compare estimated responses to +1% versus −1%, +2% versus −2%, and +4% versus −4%. Model estimates, sample sizes, and charts will be published after the experiment is run and reviewed.</p>
          </div>
        </section>

        <section aria-labelledby="standards" className="mt-14">
          <h2 id="standards" className="text-2xl font-semibold">What makes the experiment credible?</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              ["Predict using the past", "Train on earlier observations and evaluate on later dates. Account for the five-day target window so training labels never borrow outcomes from the evaluation period."],
              ["Keep model complexity visible", "Report usable observations, features, parameters, and sequence overlap. Several thousand daily records do not represent several thousand independent market histories."],
              ["Test the research calculations", "Protect return calculations, forward targets, historical features, training-only scaling, and evaluation metrics with automated tests."],
              ["Publish as we learn", "Maintain reproducible scripts, saved forecasts, a research log, and an evolving article. Report weak results as clearly as strong ones."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="roadmap" className="mt-14">
          <h2 id="roadmap" className="text-2xl font-semibold">The research plan</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-neutral-400">A roughly 14-day build, guided by seven two-day milestones. These are working estimates, not completed experiments. Part 1 must be reviewed before Part 2 begins.</p>
          <ol className="mt-7 divide-y divide-neutral-800">
            {phases.map(([number, title, description]) => (
              <li key={number} className="flex gap-5 py-6">
                <span className="pt-1 font-mono text-sm text-emerald-400">{number}</span>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Days {Number(number) * 2 - 1}–{Number(number) * 2}</p>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-10 border-t border-neutral-800 pt-6 pb-8 text-sm leading-relaxed text-neutral-400">
          Research status: project introduction. No empirical findings have been published yet.
          Repository and article links will be added when available.
        </footer>
      </div>
    </main>
  );
}
