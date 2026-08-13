import { waitForCondition } from './timing.js';

export function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(url, { ...options, signal });
}

export async function responseJson(response) {
  return JSON.parse(await response.text());
}

export async function waitForHttpServer({
  baseUrl,
  child,
  output = () => '',
  label = 'isolated server',
  timeoutMs = 10_000
}) {
  const readinessLabel = `${label} readiness`;
  try {
    await waitForCondition(async () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`${label} exited early (${child.exitCode ?? child.signalCode})\n${output()}`);
      }
      try {
        const response = await fetchWithTimeout(`${baseUrl}/healthz`, {}, 1000);
        return response.status === 200;
      } catch {
        // The child may still be binding its loopback listener.
        return false;
      }
    }, { intervalMs: 50, timeoutMs, label: readinessLabel });
  } catch (error) {
    if (error?.message === `Timed out waiting for ${readinessLabel} after ${timeoutMs}ms`) {
      throw new Error(`${label} did not become ready\n${output()}`, { cause: error });
    }
    throw error;
  }
}
