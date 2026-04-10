/* eslint-disable @typescript-eslint/no-explicit-any */

import { SIGNALSCOPE_API_BASE } from "./config";
import type { ResearchProjectState } from "./types";

export async function createResearchProject(input: {
  project_id: string;
  name: string;
  objective: string;
  hypothesis?: string;
}): Promise<ResearchProjectState> {
  const res = await fetch(`${SIGNALSCOPE_API_BASE}/project/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Project create failed: ${res.status}`);
  const payload = await res.json();
  if (!payload.valid) throw new Error(payload.reason ?? "Project create failed");
  return payload.state as ResearchProjectState;
}

export async function getResearchProjectState(projectId: string): Promise<ResearchProjectState> {
  const res = await fetch(`${SIGNALSCOPE_API_BASE}/project/${encodeURIComponent(projectId)}/state`);
  if (!res.ok) throw new Error(`Project state fetch failed: ${res.status}`);
  const payload = await res.json();
  if (!payload.valid) throw new Error(payload.reason ?? "Project state not found");
  return payload.state as ResearchProjectState;
}

export async function updateProjectBlock(
  projectId: string,
  blockId: string,
  payload: Record<string, any>
): Promise<ResearchProjectState> {
  const res = await fetch(
    `${SIGNALSCOPE_API_BASE}/project/${encodeURIComponent(projectId)}/blocks/${encodeURIComponent(blockId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    }
  );
  if (!res.ok) throw new Error(`Project block update failed: ${res.status}`);
  const data = await res.json();
  if (!data.valid) throw new Error(data.reason ?? "Project block update failed");
  return data.state as ResearchProjectState;
}

export async function setProjectChatMode(
  projectId: string,
  mode: "discussion" | "execution"
): Promise<ResearchProjectState> {
  const res = await fetch(
    `${SIGNALSCOPE_API_BASE}/project/${encodeURIComponent(projectId)}/chat_mode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }
  );
  if (!res.ok) throw new Error(`Project chat mode update failed: ${res.status}`);
  const data = await res.json();
  if (!data.valid) throw new Error(data.reason ?? "Project chat mode update failed");
  return data.state as ResearchProjectState;
}

export async function getProjectBlockDrilldown(
  projectId: string,
  blockId: string
): Promise<any> {
  const res = await fetch(
    `${SIGNALSCOPE_API_BASE}/project/${encodeURIComponent(projectId)}/blocks/${encodeURIComponent(blockId)}/drilldown`
  );
  if (!res.ok) throw new Error(`Project block drilldown failed: ${res.status}`);
  const data = await res.json();
  if (!data.valid) throw new Error(data.reason ?? "Project block drilldown failed");
  return data;
}

export async function getProjectDataProviders(): Promise<any[]> {
  const res = await fetch(`${SIGNALSCOPE_API_BASE}/project/data/providers`);
  if (!res.ok) throw new Error(`Provider catalog failed: ${res.status}`);
  const data = await res.json();
  if (!data.valid) throw new Error(data.reason ?? "Provider catalog failed");
  return Array.isArray(data.providers) ? data.providers : [];
}

export async function createProjectPaperPlan(
  projectId: string,
  source: string,
  includesCodeRepo = false
): Promise<any> {
  const res = await fetch(
    `${SIGNALSCOPE_API_BASE}/project/${encodeURIComponent(projectId)}/paper/plan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, includes_code_repo: includesCodeRepo }),
    }
  );
  if (!res.ok) throw new Error(`Paper plan failed: ${res.status}`);
  const data = await res.json();
  if (!data.valid) throw new Error(data.reason ?? "Paper plan failed");
  return data;
}
