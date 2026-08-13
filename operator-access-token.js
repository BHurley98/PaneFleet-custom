import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { open } from 'node:fs/promises';

export function validOperatorAccessToken(value) {
  const token = String(value || '');
  return token.length >= 24 && token.length <= 512 && /^[\x21-\x7e]+$/.test(token);
}

function invalidFilePermissions() {
  return new Error('orchestrator_access_token_file_permissions_invalid');
}

export async function loadOperatorAccessToken({ accessTokenPath, configuredToken = '' } = {}) {
  const configured = String(configuredToken || '').trim();
  if (configured) {
    if (!validOperatorAccessToken(configured)) throw new Error('orchestrator_access_token_invalid');
    return configured;
  }
  if (!accessTokenPath) throw new TypeError('accessTokenPath is required');

  try {
    const handle = await open(accessTokenPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${randomBytes(32).toString('base64url')}\n`, { encoding: 'utf8' });
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }

  let tokenHandle;
  try {
    tokenHandle = await open(
      accessTokenPath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK
    );
  } catch (error) {
    if (['EACCES', 'ELOOP', 'EPERM'].includes(error?.code)) throw invalidFilePermissions();
    throw error;
  }

  let operatorAccessToken;
  try {
    const tokenDetails = await tokenHandle.stat();
    const currentUid = typeof process.getuid === 'function' ? process.getuid() : tokenDetails.uid;
    const tokenMode = tokenDetails.mode & 0o777;
    if (
      !tokenDetails.isFile()
      || tokenDetails.uid !== currentUid
      || (tokenMode !== 0o400 && tokenMode !== 0o600)
    ) throw invalidFilePermissions();
    operatorAccessToken = String(await tokenHandle.readFile({ encoding: 'utf8' })).trim();
  } finally {
    await tokenHandle.close();
  }

  if (!validOperatorAccessToken(operatorAccessToken)) {
    throw new Error('orchestrator_access_token_file_invalid');
  }
  return operatorAccessToken;
}
