const REDACTION_RULES = Object.freeze([
  [/\b(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{12,}\b/g, false],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, false],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[A-Za-z0-9_-]{20,})\b/g, false],
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g, false],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi, true],
  [/\b(EXPO_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|DATABASE_URL|ADMIN_KEY|admin key|password|passwd|token|secret|api[_-]?key)\b\s*[:=]\s*['"]?[^'"\s]+/gi, true],
  [/\bpostgres(?:ql)?:\/\/[^\s]+/gi, false],
  [/\bmysql:\/\/[^\s]+/gi, false],
  [/\bredis:\/\/[^\s]+/gi, false],
  [/\bhttps?:\/\/[^/\s:@]+:[^@\s]+@[^\s]+/gi, false],
  [/\b[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{20,}\b/g, false]
]);

export function redactSensitive(value) {
  let text = String(value ?? '');
  for (const [pattern, preservePrefix] of REDACTION_RULES) {
    text = preservePrefix
      ? text.replace(pattern, (_match, prefix) => `${prefix}[REDACTED]`)
      : text.replace(pattern, '[REDACTED]');
  }
  return text;
}

export function redactionCount(original, redacted) {
  const tags = (value) => (String(value).match(/\[REDACTED\]/g) || []).length;
  return tags(redacted) - tags(original);
}
