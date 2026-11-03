const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isTestFile, diffPageKey } = require('../core.js');

for (const name of [
  'tests/helpers.json', 'src/__tests__/button.tsx', 'src/__snapshots__/ui.snap',
  'pkg/client/testdata/expected_config.yaml',
  'pkg/client/network_test.go', 'pkg/client/lifecycle_intg_test.go',
  'pkg/internal_handler_intg_test.go',
  'src/button.test.tsx', 'src/button.spec.ts', 'cypress/e2e/login.cy.ts',
  'pkg/test_parser.py', 'pkg/tests.py', 'pkg/parser_test.py', 'spec/model_spec.rb',
  'src/UserTests.cs', 'src/UserTest.java', 'src/TestUser.java', 'src/UserSpec.kt',
  'integration-tests/helpers/setup.json', 'src\\tests\\foo.js',
  'src/client.test.mts', 'src/client.test.cts', 'src/client.test.cjs',
  'src/client.spec.mjs', 'src/client.eval.mts', 'src/client.bench.ts',
  'src/client.benchmark.js', 'src/client.test.ts.snap',
  'test_data/request.json', 'test-data/response.json',
  'src/__fixtures__/response.json', 'pkg/testutil/database.go',
  'pkg/test_utils/database.go', 'src/test-helpers/render.tsx',
  'src/evals/runner/case.mts', 'hurl/auth/login.hurl',
  'hurl/run.sh', 'api/requests/login.hurl',
  'scripts/k6/traffic.js', 'benchmark/benchmark-traffic.js',
  'benchmarks/throughput-benchmark.py', 'src/e2eTest/kotlin/BrowserFlow.kt',
  'src/integrationTest/java/Connection.java', 'functional_tests/login.py',
  'packages/web-e2e/src/utils/login.ts', 'suites/browser_e2e/setup.ts',
  'src/grid.spec.ts-snapshots/grid-chromium.png',
  'src/grid.test.tsx-snapshots/grid-webkit.png',
  'infra/validation.tftest.hcl', 'infra/validation.tftest.json',
  'scripts/test-api.py', 'scripts/test_headers.mjs', 'src/test_client.ts',
  'src/client_test.js', 'src/client-test.tsx', 'scripts/smoke-tests.sh',
  'conftest.py', 'api/conftest.py', 'api/pytest.ini',
  'vitest.config.mts', 'vitest.setup.ts', 'jest.config.cjs',
  'playwright.config.ts', 'playwright.global-setup.ts', 'cypress.config.ts',
  'scripts/playwright-fcp.mts', 'src/test-utils.tsx',
  'src/test_helpers.mts', 'pkg/test_utils.go', 'pkg/cache_test_helpers.go',
  'pkg/redis_test_utils.py', 'PKG/TEST_DATA/response.json',
  'src\\e2eTest\\kotlin\\BrowserFlow.kt'
]) test(`recognizes ${name}`, () => assert.equal(isTestFile(name), true));

for (const name of [
  'src/latest.ts', 'src/contest.go', 'src/testament.py', 'docs/test-plan.md',
  'src/specification.ts', 'test.config.ts', 'test-data.json',
  'src/fixtures/config.json', 'src/testing/client.go', 'src/UserTestFactory.java',
  'src/latest.mts', 'pkg/test_hop.go', 'pkg/handler_test_eval.go',
  'src/snapshot_builder.go', 'src/evaluators/handler.go',
  'src/tuned_evals/handler.py', 'src/evaluation/handler.py',
  'src/benchmarking/metrics.go', 'src/k6-client/http.ts',
  'src/pages/benchmarks/Page.tsx', 'src/pages/benchmarks/api.ts',
  'src/benchmark/client.go',
  'src/hurling/player.ts', 'src/testimonials/card.tsx',
  'src/test_data_export/client.py', 'src/test_utils_factory/client.ts',
  'packages/web-e2e-client/index.ts', 'src/e2eTestFactory/client.kt',
  'src/grid.spec.ts-assets/grid.png', 'src/grid.ts-snapshots/grid.png',
  'src/client.test.ts.backup', 'infra/validation.tftest.hcl.backup',
  'docs/conftest.py.md', 'docs/playwright.config.ts.md',
  'src/vitest.config.parser.ts', 'eslint/prefer-test-utils.js',
  'README.md', '', null, undefined
]) test(`leaves ${String(name)}`, () => assert.equal(isTestFile(name), false));

test('accepts Changes routes and commit comparisons', () => {
  for (const suffix of ['changes', 'changes/abcdef', 'changes/abcdef..123456']) {
    assert.equal(diffPageKey(`https://github.com/org/repo/pull/42/${suffix}?w=1#diff-abc`), `/org/repo/pull/42/${suffix}`);
  }
});
test('rejects other pages and origins', () => {
  for (const url of [
    'https://github.com/org/repo/pull/42',
    'https://github.com/org/repo/pull/42/files',
    'https://github.com/org/repo/pull/42/files/abcdef',
    'https://github.com/org/repo/pull/42/checks',
    'https://github.com/org/repo/pull/42/changeset',
    'https://github.com/org/repo/pull/new/changes',
    'https://github.com/org/repo/issues/42/changes',
    'https://github.com/org/repo/commit/abc',
    'https://github.com/org/pull/42/changes',
    'https://example.com/org/repo/pull/42/changes',
    'https://github.com.evil.test/org/repo/pull/42/changes',
    'http://github.com/org/repo/pull/42/changes',
    'invalid'
  ]) assert.equal(diffPageKey(url), null);
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
