/** Resolve an explicitly supplied artifact from repo root. Never silently fall back. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
export async function loadRouteArtifact(configured=process.env.ROUTELEAF_ROUTES_FILE){
  const routePath=resolve(repoRoot,configured||'generated/workshop-en.routes.json');
  const artifactBytes=await readFile(routePath);
  return {artifactBytes,manifest:JSON.parse(artifactBytes),routeInputPath:relative(repoRoot,routePath),routeInputMode:configured?'explicit-input':'generated-fixture'};
}
