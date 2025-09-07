import { PyodideRunner } from '../app/pyodideRunner.js';

interface CheckPackagesServices {
  pyodideRunner: PyodideRunner;
}

export async function checkPackages(
  sessionId: string,
  params: {},
  services: CheckPackagesServices,
): Promise<{ status: string; missing: string[] }> {
  const { pyodideRunner } = services;
  const code = `
import micropip
import numpy
import pandas
import pulp

installed = set(micropip.list_packages().keys())
required = {"numpy", "pandas", "pulp"}
missing = list(required - installed)
missing
`;
  const missing = (await pyodideRunner.run(sessionId, code)) as string[];

  if (missing.length > 0) {
    return { status: 'error', missing: missing };
  }
  return { status: 'ok', missing: [] };
}
