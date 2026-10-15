const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const popupSource = fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8');
const contentSource = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function popup(storage) {
  const listeners = {};
  const input = { disabled: true, checked: false, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const status = { textContent: '' };
  vm.runInNewContext(popupSource, {
    document: { getElementById: id => id === 'enabled' ? input : status },
    chrome: { storage: { local: storage } }
  });
  return { input, status, change: () => listeners.change() };
}
test('popup starts enabled by default', async () => {
  const ui = popup({ get: async defaults => defaults });
  await flush();
  assert.equal(ui.input.checked, true);
  assert.equal(ui.input.disabled, false);
});
test('popup reads and saves the off setting', async () => {
  let saved;
  const ui = popup({ get: async () => ({ enabled: false }), set: async value => { saved = value; } });
  await flush();
  assert.equal(ui.input.checked, false);
  ui.input.checked = true;
  await ui.change();
  assert.equal(saved.enabled, true);
  assert.match(ui.status.textContent, /^On/);
  ui.input.checked = false;
  await ui.change();
  assert.equal(saved.enabled, false);
  assert.match(ui.status.textContent, /^Off/);
});
test('popup restores its state after a save error', async () => {
  const ui = popup({ get: async defaults => defaults, set: async () => { throw Error('storage failed'); } });
  await flush();
  ui.input.checked = false;
  await ui.change();
  assert.equal(ui.input.checked, true);
  assert.equal(ui.input.disabled, false);
  assert.match(ui.status.textContent, /Could not save/);
});
test('popup reports an initial storage error', async () => {
  const ui = popup({ get: async () => { throw Error('storage failed'); } });
  await flush();
  assert.equal(ui.input.disabled, true);
  assert.match(ui.status.textContent, /Could not read/);
});
test('popup treats a malformed preference as off', async () => {
  const ui = popup({ get: async () => ({ enabled: 'false' }) });
  await flush();
  assert.equal(ui.input.checked, false);
});

function content(get) {
  let listener;
  let started = false;
  const settings = [];
  const local = { get };
  const context = {
    chrome: { storage: { local, onChanged: { addListener: fn => { listener = fn; }, removeListener: () => { listener = null; } } } },
    GitHubTestViewed: { createController: () => { started = true; return { setEnabled: value => settings.push(value) }; } },
    document: {}, location: { href: 'https://github.com/org/repo/pull/1/files' },
    MutationObserver: function () {}, window: { setTimeout, clearTimeout }, console: { warn() {} }
  };
  vm.runInNewContext(contentSource, context);
  return { settings, started: () => started, change: value => listener({ enabled: { newValue: value } }, 'local') };
}
test('content script applies the saved off setting before the first scheduled scan', async () => {
  const script = content(async () => ({ enabled: false }));
  await flush();
  assert.equal(script.started(), true);
  assert.deepEqual(script.settings, [false]);
  script.change(true);
  assert.deepEqual(script.settings, [false, true]);
});
test('a live setting change wins over stale startup settings', async () => {
  let resolveGet;
  const script = content(() => new Promise(resolve => { resolveGet = resolve; }));
  script.change(false);
  resolveGet({ enabled: true });
  await flush();
  assert.deepEqual(script.settings, [false]);
});
test('content script does not start after a storage read error', async () => {
  const script = content(async () => { throw Error('storage failed'); });
  await flush();
  assert.equal(script.started(), false);
});
test('content script validates saved and live preferences', async () => {
  const script = content(async () => ({ enabled: 'true' }));
  await flush();
  script.change('false');
  script.change(undefined);
  assert.deepEqual(script.settings, [false, false, true]);
});
