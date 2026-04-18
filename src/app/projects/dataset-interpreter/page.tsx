export default function DatasetInterpreterProjectPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 py-14">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Project</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Dataset Interpreter</h1>
          </div>
          <a href="/projects" className="text-sm text-neutral-400 hover:text-white transition">
            All Projects
          </a>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-xl font-semibold">What It Does</h2>
            <p className="mt-4 text-sm leading-relaxed text-neutral-300">
              Dataset Interpreter is a decision-support system built for unknown tabular datasets. It runs an async
              analysis pipeline to identify data quality problems, infer dataset structure, and generate grounded AI
              guidance on what to do next for machine learning.
            </p>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">Core Pipeline</h3>
            <ul className="mt-3 space-y-2 text-sm text-neutral-300">
              <li>Ingestion: Kaggle competition dataset pull + primary CSV selection.</li>
              <li>Profiling: types, missingness, summary stats, distributions, cardinality.</li>
              <li>Issue Detection: duplicates, outliers, type inconsistencies, severity ranking.</li>
              <li>AI Interpretation: grounded explanation, ML framing, risks, next steps.</li>
              <li>Optional Cleaning: imputation, deduplication, type fixes, cleaned artifact metadata.</li>
            </ul>
          </article>

          <aside className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-lg font-semibold">Access</h2>
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
              The live app is intentionally localhost-only to protect paid API integrations from public abuse. The
              public website provides architecture and project context; the interactive workflow runs in local demo
              mode.
            </p>

            <a
              href="/projects/dataset-interpreter/demo"
              className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-100 transition"
            >
              Open Demo Route
            </a>

            <div className="mt-6 border-t border-neutral-800 pt-4 text-xs text-neutral-500 leading-relaxed">
              Backend is deployed separately and integrated through API calls from this frontend surface.
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-lg font-semibold">Run Local Demo</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            Best-practice mode keeps this interactive app localhost-only to avoid exposing paid API usage publicly.
            Run both backend and frontend locally:
          </p>

          <pre className="mt-4 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-200">
{`# Terminal 1: backend
cd /Users/richardwuebker/Projects/workbench/dataset-interpreter/backend
set -a
source ../.env/backend.env
set +a
poetry run uvicorn app.main:app --reload

# Terminal 2: frontend
cd /Users/richardwuebker/Projects/workbench/rwuebker.github.io
npm run dev`}
          </pre>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">Required Backend Env Vars</h3>
          <pre className="mt-3 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-200">
{`# /Users/richardwuebker/Projects/workbench/dataset-interpreter/.env/backend.env
OPENAI_API_KEY=your_openai_api_key
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key

# Recommended toggles
ENABLE_REAL_AI_INTERPRETATION=true
ENABLE_REAL_KAGGLE_INGESTION=true
ENABLE_CLEANING_OUTPUT=true
SIMULATE_JOB_FAILURE_PROBABILITY=0.0`}
          </pre>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Then open <span className="font-mono text-neutral-300">http://localhost:3000/projects/dataset-interpreter/demo</span>.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Never commit keys to GitHub. Keep them only in local gitignored env files.
          </p>
        </section>
      </div>
    </main>
  );
}
