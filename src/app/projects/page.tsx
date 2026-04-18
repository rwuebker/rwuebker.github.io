export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 py-14">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <a href="/" className="text-sm text-neutral-400 hover:text-white transition">
            Back Home
          </a>
        </header>

        <section className="mt-10 grid gap-5">
          <a
            href="/projects/dataset-interpreter"
            className="group rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 hover:border-neutral-600 transition"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Public Project</p>
            <h2 className="mt-2 text-2xl font-semibold text-white group-hover:text-neutral-100">Dataset Interpreter</h2>
            <p className="mt-3 max-w-3xl text-sm text-neutral-300 leading-relaxed">
              An AI-assisted system that ingests unknown datasets, diagnoses quality issues, and explains how to use
              the data for machine learning decisions.
            </p>
          </a>
        </section>
      </div>
    </main>
  );
}
