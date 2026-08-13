import { isIP } from 'node:net';

function normalizedIpv4(value) {
  const text = String(value || '').trim().replace(/^::ffff:/, '');
  if (isIP(text) !== 4) return '';
  return text.split('.').map(Number).join('.');
}

function isLoopbackPeer(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === '::1') return true;
  const ipv4 = normalizedIpv4(text);
  return ipv4.startsWith('127.');
}

export function trustedLoopbackProxyIpv4({
  remoteAddress,
  forwardedFor,
  enabled = false
} = {}) {
  if (!enabled || !isLoopbackPeer(remoteAddress) || typeof forwardedFor !== 'string') return '';
  const candidate = forwardedFor.trim();
  if (!candidate || candidate.includes(',')) return '';
  return normalizedIpv4(candidate);
}
