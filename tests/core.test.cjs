const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isTestFile, diffPageKey } = require('../core.js');

for (const name of [
  'tests/helpers.json', 'src/__tests__/button.tsx', 'src/__snapshots__/ui.snap',
  'pkg/client/testdata/expected_config.yaml',
  'pkg/client/network_test.go', 'pkg/client/lifecycle_intg_test.go',
  'src/button.test.tsx', 'src/button.spec.ts', 'cypress/e2e/login.cy.ts',
  'pkg/test_parser.py', 'pkg/tests.py', 'pkg/parser_test.py', 'spec/model_spec.rb',
  'src/UserTests.cs', 'src/UserTest.java', 'src/TestUser.java', 'src/UserSpec.kt',
  'integration-tests/helpers/setup.json', 'src\\tests\\foo.js'
]) test(`recognizes ${name}`, () => assert.equal(isTestFile(name), true));

for (const name of [
  'src/latest.ts', 'src/contest.go', 'src/testament.py', 'docs/test-plan.md',
  'src/test_client.ts', 'src/specification.ts', 'test.config.ts', 'test-data.json',
  'src/fixtures/config.json', 'src/testing/client.go', 'src/UserTestFactory.java',
  'README.md', '', null, undefined
]) test(`leaves ${String(name)}`, () => assert.equal(isTestFile(name), false));

test('accepts both diff routes and commit comparisons', () => {
  for (const suffix of ['files', 'changes', 'files/abcdef', 'changes/abcdef..123456']) {
    assert.equal(diffPageKey(`https://github.com/org/repo/pull/42/${suffix}?w=1#diff-abc`), `/org/repo/pull/42/${suffix}`);
  }
});
test('rejects other pages and origins', () => {
  for (const url of ['https://github.com/org/repo/pull/42', 'https://github.com/org/repo/commit/abc', 'https://github.com/org/repo/pull/42/checks', 'https://example.com/org/repo/pull/42/files', 'https://github.com.evil.test/org/repo/pull/42/files', 'http://github.com/org/repo/pull/42/files', 'invalid']) assert.equal(diffPageKey(url), null);
});
test('manifest limits permissions and references existing files', () => {
  const base = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  assert.equal(manifest.background, undefined);
  for (const file of [...manifest.content_scripts[0].js, manifest.action.default_popup]) assert.equal(fs.existsSync(path.join(base, file)), true);
});
