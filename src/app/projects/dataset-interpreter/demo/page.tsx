import DatasetInterpreterDemoClient from "@/components/dataset-interpreter/DatasetInterpreterDemoClient";

export default function DatasetInterpreterDemoPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-8 py-14">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Live Demo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dataset Interpreter</h1>
          </div>
          <a href="/projects/dataset-interpreter" className="text-sm text-neutral-400 hover:text-white transition">
            Project Overview
          </a>
        </header>

        <div className="mt-8">
          <DatasetInterpreterDemoClient />
        </div>
      </div>
    </main>
  );
}
