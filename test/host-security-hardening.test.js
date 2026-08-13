import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const securityBundle = (...parts) => path.join(root, 'deploy', 'host-security', ...parts);

function directives(source) {
  return new Map(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.search(/[\s=]/);
      assert.notEqual(separator, -1, `missing directive separator: ${line}`);
      const key = line.slice(0, separator);
      const value = line.slice(separator).replace(/^\s*=\s*|^\s+/, '');
      return [key.toLowerCase(), value.toLowerCase()];
    }));
}

test('SSH hardening preserves public-key access while removing remote expansion paths', async () => {
  const source = await readFile(securityBundle('10-panefleet-sshd-hardening.conf'), 'utf8');
  const values = directives(source);
  const expected = {
    permitrootlogin: 'no',
    passwordauthentication: 'no',
    kbdinteractiveauthentication: 'no',
    challengeresponseauthentication: 'no',
    pubkeyauthentication: 'yes',
    authenticationmethods: 'publickey',
    gssapiauthentication: 'no',
    hostbasedauthentication: 'no',
    ignorerhosts: 'yes',
    permitemptypasswords: 'no',
    permituserenvironment: 'no',
    allowagentforwarding: 'no',
    allowtcpforwarding: 'no',
    allowstreamlocalforwarding: 'no',
    gatewayports: 'no',
    x11forwarding: 'no',
    permittunnel: 'no',
    logingracetime: '30',
    maxauthtries: '3',
    maxsessions: '4',
    maxstartups: '10:30:30',
    clientaliveinterval: '300',
    clientalivecountmax: '2'
  };
  assert.deepEqual(Object.fromEntries(values), expected);
  assert.doesNotMatch(source, /^\s*(?:AllowUsers|DenyUsers|Match|ForceCommand|ChrootDirectory)\b/m);
});

test('sysctl hardening rejects redirects and source routes without disabling cloud routing', async () => {
  const source = await readFile(securityBundle('60-panefleet-sysctl-hardening.conf'), 'utf8');
  const values = directives(source);
  for (const key of [
    'net.ipv4.conf.all.accept_redirects',
    'net.ipv4.conf.default.accept_redirects',
    'net.ipv4.conf.all.secure_redirects',
    'net.ipv4.conf.default.secure_redirects',
    'net.ipv4.conf.all.send_redirects',
    'net.ipv4.conf.default.send_redirects',
    'net.ipv4.conf.all.accept_source_route',
    'net.ipv4.conf.default.accept_source_route',
    'net.ipv6.conf.all.accept_redirects',
    'net.ipv6.conf.default.accept_redirects',
    'net.ipv6.conf.all.accept_source_route',
    'net.ipv6.conf.default.accept_source_route'
  ]) assert.equal(values.get(key), '0', key);
  assert.equal(values.get('net.ipv4.conf.all.rp_filter'), '2');
  assert.equal(values.get('net.ipv4.conf.default.rp_filter'), '2');
  assert.equal(values.get('net.ipv4.conf.all.log_martians'), '1');
  assert.equal(values.get('net.ipv4.conf.default.log_martians'), '1');
  assert.equal(values.get('kernel.dmesg_restrict'), '1');
  assert.equal(values.get('kernel.kptr_restrict'), '2');
  assert.equal(values.get('kernel.yama.ptrace_scope'), '1');
  assert.equal(values.get('fs.protected_hardlinks'), '1');
  assert.equal(values.get('fs.protected_symlinks'), '1');
  assert.equal(values.has('net.ipv4.ip_forward'), false);
  assert.equal(values.has('net.ipv6.conf.all.disable_ipv6'), false);
  assert.equal(values.has('kernel.kexec_load_disabled'), false);
});

test('audit policy template replaces task suppression with bounded configuration watches', async () => {
  const source = await readFile(securityBundle('audit.rules.template'), 'utf8');
  const rules = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  assert.equal(rules[0], '-D');
  assert.ok(rules.includes('-b 1024'));
  assert.ok(rules.includes('--backlog_wait_time 60000'));
  assert.ok(rules.includes('-f 1'));
  assert.equal(rules.filter((rule) => rule.startsWith('-w ')).length, 16);
  for (const pathPrefix of [
    '/etc/passwd ',
    '/etc/sudoers ',
    '/etc/ssh ',
    '/etc/systemd/system ',
    '@OPERATOR_HOME@/.config/systemd/user ',
    '/etc/sysctl.d ',
    '/etc/audit ',
    '/etc/caddy ',
    '@OPERATOR_HOME@/.ssh ',
    '/root/.ssh ',
    '@DROP_HOME@/.ssh '
  ]) assert.ok(rules.some((rule) => rule.startsWith(`-w ${pathPrefix}`)), pathPrefix);
  assert.doesNotMatch(source, /(?:^|\s)-a\s+(?:task,never|never,task)(?:\s|$)/m);
  assert.doesNotMatch(rules.join('\n'), /(?:execve|connect|accept|socket|chmod|chown)/i);
  assert.doesNotMatch(source, /^-e\s+2$/m);
  assert.equal((source.match(/@OPERATOR_HOME@/g) || []).length, 2);
  assert.equal((source.match(/@DROP_HOME@/g) || []).length, 1);
});

test('firewall template defaults inbound to one home address without restricting agent egress', async () => {
  const source = await readFile(securityBundle('panefleet.nft.template'), 'utf8');
  assert.match(source, /^define home_ipv4 = @HOME_IPV4@$/m);
  assert.equal((source.match(/@HOME_IPV4@/g) || []).length, 1);
  assert.match(source, /chain input \{[\s\S]*policy drop;/);
  assert.match(source, /iifname "lo" accept/);
  assert.match(source, /ct state established,related accept/);
  assert.match(source, /ip6 nexthdr ipv6-icmp accept/);
  assert.match(source, /udp sport 67 udp dport 68 accept/);
  assert.match(source, /udp sport 547 udp dport 546 accept/);
  assert.match(source, /ip saddr \$home_ipv4 tcp dport \{ 22, 80, 443 \} ct state new accept/);
  assert.match(source, /chain forward \{[\s\S]*policy drop;/);
  assert.match(source, /chain output \{[\s\S]*policy accept;/);
  assert.doesNotMatch(source, /0\.0\.0\.0\/0|::\/0|tcp dport \{[^}]*8787|tcp dport \{[^}]*8104/);
  assert.doesNotMatch(source, /hook output[^;]*;\s*policy drop/);
});
