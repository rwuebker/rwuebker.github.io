"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CreateJobResponse = {
  job_id: string;
  status: string;
};

type JobResponse = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  current_stage: string | null;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeApiBase(rawValue: string): string {
  const trimmed = rawValue.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeCompetitionInput(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  const marker = "/competitions/";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) {
    return trimmed;
  }

  const afterMarker = trimmed.slice(markerIndex + marker.length);
  const slug = afterMarker.split(/[/?#]/, 1)[0];
  return slug || trimmed;
}

export default function DatasetInterpreterDemoClient() {
  const apiBase = useMemo(() => {
    const fromDedicated = process.env.NEXT_PUBLIC_DATASET_INTERPRETER_API_URL;
    const fromFallback = process.env.NEXT_PUBLIC_API_URL;
    return normalizeApiBase(fromDedicated || fromFallback || "http://127.0.0.1:8011");
  }, []);

  const [gateReady, setGateReady] = useState(false);
  const [localhostAccess, setLocalhostAccess] = useState(false);

  const [competition, setCompetition] = useState("titanic");
  const [job, setJob] = useState<JobResponse | null>(null);
  const [jobError, setJobError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalhostAccess(isLocalhost(window.location.hostname));
    setGateReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const fetchJob = async (jobId: string) => {
    const response = await fetch(`${apiBase}/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch job status (${response.status})`);
    }

    const payload = (await response.json()) as JobResponse;
    setJob(payload);

    if (payload.status === "completed" || payload.status === "failed") {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  };

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJobError("");
    const competitionSlug = normalizeCompetitionInput(competition);
    if (!competitionSlug) {
      setJobError("Please enter a Kaggle competition slug or URL.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBase}/jobs/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "kaggle",
          kaggle: { competition: competitionSlug },
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Job create failed (${response.status}): ${message}`);
      }

      const payload = (await response.json()) as CreateJobResponse;
      setJob(null);

      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }

      await fetchJob(payload.job_id);
      pollTimerRef.current = window.setInterval(() => {
        void fetchJob(payload.job_id);
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setJobError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!gateReady) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-sm text-neutral-300">
        Loading demo access state...
      </div>
    );
  }

  if (!localhostAccess) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-xl font-semibold">Localhost-Only Demo</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          This live app is intentionally disabled on public web hosting to prevent abuse of paid API integrations.
          The full interactive demo runs on localhost only.
        </p>

        <pre className="mt-5 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-200">
{`# Local demo run
cd dataset-interpreter/backend
set -a
source ../.env/backend.env
set +a
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8011

# Frontend (separate terminal)
cd rwuebker.github.io
npm run dev`}
        </pre>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Dataset Interpreter Demo</h2>
          <span className="text-xs uppercase tracking-[0.16em] text-emerald-300">Localhost Access Enabled</span>
        </div>

        <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
          API Base: <span className="font-mono text-neutral-200">{apiBase}</span>
        </p>

        <form onSubmit={createJob} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="competition" className="mb-2 block text-xs uppercase tracking-[0.12em] text-neutral-500">
              Kaggle Competition Slug
            </label>
            <input
              id="competition"
              type="text"
              value={competition}
              onChange={(event) => setCompetition(event.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-neutral-500"
              placeholder="titanic or house-prices-advanced-regression-techniques"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Use the slug after <span className="font-mono text-neutral-300">/competitions/</span>, or paste the full Kaggle competition URL.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-100 transition disabled:opacity-60 md:self-end"
          >
            {isSubmitting ? "Creating..." : "Create Job"}
          </button>
        </form>

        {jobError ? <p className="mt-3 text-sm text-red-300">{jobError}</p> : null}
      </div>

      {job ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Status</p>
              <p className="mt-1 text-sm text-white">{job.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Stage</p>
              <p className="mt-1 text-sm text-white">{job.current_stage || "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Progress</p>
              <p className="mt-1 text-sm text-white">{job.progress}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Job ID</p>
              <p className="mt-1 break-all font-mono text-xs text-neutral-200">{job.job_id}</p>
            </div>
          </div>

          <pre className="mt-5 max-h-[460px] overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-200">
            {JSON.stringify(job, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
