import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

export async function ensurePrivateDirectory(directoryPath) {
  if (!path.isAbsolute(directoryPath)) throw new TypeError('directoryPath must be absolute');
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  const handle = await open(
    directoryPath,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    await handle.chmod(0o700);
  } finally {
    await handle.close();
  }
}

async function syncParentDirectory(filePath) {
  const directoryHandle = await open(path.dirname(filePath), 'r');
  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

export async function writeJsonAtomic(filePath, value, { spaces = 0, trailingNewline = true } = {}) {
  if (!path.isAbsolute(filePath)) throw new TypeError('filePath must be absolute');
  if (!Number.isInteger(spaces) || spaces < 0 || spaces > 8) throw new TypeError('spaces must be an integer from 0 to 8');
  if (typeof trailingNewline !== 'boolean') throw new TypeError('trailingNewline must be boolean');
  const serialized = JSON.stringify(value, null, spaces);
  if (serialized === undefined) throw new TypeError('value must be JSON serializable');
  const contents = trailingNewline ? `${serialized}\n` : serialized;
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  let handle = null;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
    await syncParentDirectory(filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
