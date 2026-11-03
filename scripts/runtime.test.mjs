import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// Evaluate the actual production functions in an isolated context with synthetic storage.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = source.indexOf('    function isCipher(');
const end = source.indexOf('    function clearSettingsRaw()', start);
assert.ok(start >= 0 && end > start);
function setup(initial = {}) {
  const data = new Map(Object.entries(initial));
  const failures = new Set();
  const localStorage = {
    getItem(key) { if (failures.has('get:' + key)) throw Error('get failed'); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { if (failures.has('set:' + key)) throw Error('set failed'); data.set(key, value); },
    removeItem(key) { if (failures.has('remove:' + key)) throw Error('remove failed'); data.delete(key); },
  };
  const context = vm.createContext({ window: { localStorage, atob, btoa }, SCHEMA: 'dsh.account-vault', FILE_SCHEMA: 'dsh.account-vault-file', VAULT_VERSION: 1, FILE_VERSION: 2, KDF_MIN_ITERATIONS: 100000, KDF_MAX_ITERATIONS: 2000000, STORAGE_KEY: 'dsh.account-vault.v2', LEGACY_KEY: 'dsh.account-vault.v1', ensureVaultIds: vaults => vaults });
  vm.runInContext(source.slice(start, end), context);
  return { context, data, failures };
}
const b64 = bytes => Buffer.alloc(bytes).toString('base64');
const record = { schema: 'dsh.account-vault', version: 1, kdf: { algo: 'PBKDF2-SHA-256', salt: b64(16), iterations: 600000 }, cipher: { iv: b64(12), ct: b64(32) } };
const file = vaults => JSON.stringify({ schema: 'dsh.account-vault-file', version: 2, vaults });
const key = 'dsh.account-vault.v2';
const legacy = 'dsh.account-vault.v1';

test('valid v2 and legacy v1 parse, but mixed or unknown versions reject entirely', () => {
  const { context: c } = setup();
  assert.equal(c.parseVaultFile(file([record])).vaults.length, 1);
  assert.equal(c.parseVaultFile(JSON.stringify(record)).vaults.length, 1);
  assert.equal(c.parseVaultFile(file([record, {}])), null);
  assert.equal(c.parseVaultFile(file([record, { ...record, version: 2 }])), null);
  assert.equal(c.parseVaultFile(JSON.stringify({ schema: 'dsh.account-vault-file', version: 3, vaults: [record] })), null);
  assert.equal(c.parseVaultFile(JSON.stringify({ ...record, version: 2 })), null);
  assert.equal(c.parseVaultFile(file([])), null);
});

test('rejects malformed cryptographic fields for both single and multi-vault imports', () => {
  const { context: c } = setup();
  const variants = [
    ...['', '!!!!', b64(15), b64(17), b64(16).replace(/==$/, 'AB'), b64(16).replace(/==$/, ''), b64(16) + '\n'].map(salt => ({ ...record, kdf: { ...record.kdf, salt } })),
    ...['', b64(11), b64(13), '!!!!'].map(iv => ({ ...record, cipher: { ...record.cipher, iv } })),
    ...['', b64(15), '!!!!', b64(16).replace(/A==$/, 'B==')].map(ct => ({ ...record, cipher: { ...record.cipher, ct } })),
    ...['SHA-1', '', null].map(algo => ({ ...record, kdf: { ...record.kdf, algo } })),
    ...[99999, 2000001, 100000.5, '100000.5', null, true, '1e5'].map(iterations => ({ ...record, kdf: { ...record.kdf, iterations } })),
  ];
  for (const bad of variants) {
    assert.equal(c.parseVaultFile(JSON.stringify(bad)), null, JSON.stringify(bad));
    assert.equal(c.parseVaultFile(file([record, bad])), null, JSON.stringify(bad));
  }
  for (const iterations of [100000, 2000000, '600000']) {
    assert.ok(c.validateRecord({ ...record, kdf: { ...record.kdf, iterations } }));
  }
  const { algo, ...oldKdf } = record.kdf;
  assert.ok(c.validateRecord({ ...record, kdf: oldKdf }));
  assert.ok(c.validateRecord({ ...record, cipher: { ...record.cipher, ct: b64(16) } }));
});

test('actual generated ciphertext validates and decrypts in old and file formats', async () => {
  const begin = source.indexOf('    const textEncoder = new TextEncoder();');
  const cryptoContext = vm.createContext({
    window: { crypto: webcrypto, atob, btoa }, TextEncoder, TextDecoder, Uint8Array,
    SCHEMA: 'dsh.account-vault', FILE_SCHEMA: 'dsh.account-vault-file', VAULT_VERSION: 1, FILE_VERSION: 2,
    KDF_MIN_ITERATIONS: 100000, KDF_MAX_ITERATIONS: 2000000, AAD: 'dsh-account-vault:v1',
  });
  vm.runInContext(source.slice(begin, source.indexOf('    /* ------------------------------------------------------------------ */\n    /* Storage', begin)), cryptoContext);
  const salt = cryptoContext.randomBytes(16);
  const key = await cryptoContext.deriveKey('test password', salt, 100000);
  const cipher = await cryptoContext.encryptPayload(key, { entries: [{ name: 'example' }] });
  const generated = { ...record, kdf: { algo: 'PBKDF2-SHA-256', iterations: 100000, salt: cryptoContext.toBase64(salt) }, cipher };
  for (const raw of [JSON.stringify(generated), file([generated])]) {
    const parsed = cryptoContext.parseVaultFile(raw);
    assert.ok(parsed);
    const unlocked = await cryptoContext.decryptPayload(key, parsed.vaults[0].cipher);
    assert.equal(unlocked.entries[0].name, 'example');
  }
});

test('deletion failures propagate and preserve ciphertext', () => {
  const { context: c, data, failures } = setup({ [key]: file([record]), [legacy]: JSON.stringify(record) });
  failures.add('remove:' + key);
  assert.throws(() => c.clearFileRaw(), /remove failed/);
  assert.equal(data.get(key), file([record]));
  failures.add('remove:' + legacy);
  assert.throws(() => c.clearLegacyRaw(), /remove failed/);
  assert.equal(data.get(legacy), JSON.stringify(record));
});

test('invalid local data and read failure never become an empty vault or overwrite legacy', () => {
  const bad = file([record, {}]);
  const s = setup({ [key]: bad, [legacy]: JSON.stringify(record) });
  assert.throws(() => s.context.loadVaultFile(), /Invalid or unsupported/);
  assert.equal(s.data.get(key), bad);
  s.failures.add('get:' + key);
  assert.throws(() => s.context.loadVaultFile(), /get failed/);
  assert.equal(s.data.get(legacy), JSON.stringify(record));
});

test('legacy migration retains old ciphertext if writing or cleanup fails', () => {
  const s = setup({ [legacy]: JSON.stringify(record) });
  s.failures.add('set:' + key);
  assert.throws(() => s.context.loadVaultFile(), /set failed/);
  assert.equal(s.data.get(legacy), JSON.stringify(record));
  assert.equal(s.data.has(key), false);
  s.failures.clear();
  s.failures.add('remove:' + legacy);
  assert.equal(s.context.loadVaultFile().vaults.length, 1);
  assert.equal(s.data.get(legacy), JSON.stringify(record));
  assert.ok(s.data.get(key));
});
