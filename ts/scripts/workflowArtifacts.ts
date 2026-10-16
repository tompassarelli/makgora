import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workflows = join(import.meta.dir, "../../.github/workflows");

interface Step { readonly uses?: string; readonly with?: Readonly<Record<string, unknown>> }
interface Workflow { readonly jobs?: Readonly<Record<string, { readonly steps?: readonly Step[] }>> }

const expression = /\$\{\{[^}]*\}\}/g;
const sampleName = (name: string): string => name.replace(expression, "0");
const globMatcher = (pattern: string): RegExp => new RegExp(`^${pattern.replace(expression, "\u0000").replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\u0000/g, ".*")}$`);

export function artifactMatches(): string[] {
  return readdirSync(workflows).filter((file) => /\.ya?ml$/.test(file)).toSorted().flatMap((file) => {
    const workflow = Bun.YAML.parse(readFileSync(join(workflows, file), "utf8")) as Workflow;
    const steps = Object.entries(workflow.jobs ?? {}).flatMap(([job, definition]) => (definition.steps ?? []).map((step) => ({ job, step })));
    const uploads = steps.filter(({ step }) => step.uses?.startsWith("actions/upload-artifact") === true).map(({ job, step }) => ({ job, name: String(step.with?.name ?? "artifact") }));
    const downloads = steps.filter(({ step }) => step.uses?.startsWith("actions/download-artifact") === true).map(({ job, step }) => ({ job, pattern: String(step.with?.pattern ?? step.with?.name ?? "*") }));
    return downloads.flatMap((download) => uploads.filter((upload) => upload.job !== download.job && globMatcher(download.pattern).test(sampleName(upload.name)))
      .map((upload) => `${file}: ${upload.job} ${upload.name} -> ${download.job} ${download.pattern}`));
  });
}
