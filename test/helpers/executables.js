import { chmodSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function writeExecutable(file, source) {
  writeFileSync(file, source, { mode: 0o755 });
  chmodSync(file, 0o755);
}

export function installExecutable(binDir, name, source) {
  if (!path.isAbsolute(binDir)) {
    throw new TypeError('Test executable directory must be absolute');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new TypeError(`Unsafe test executable name: ${name}`);
  }
  const executable = path.join(binDir, name);
  writeExecutable(executable, source);
  return executable;
}

export function installBlockedTool(binDir, name) {
  return installExecutable(
    binDir,
    name,
    `#!/bin/sh\nprintf '%s\\n' '${name}' >> "$ORCH_TOOL_LOG"\nexit 97\n`
  );
}
