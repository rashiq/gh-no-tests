const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { diffPageKey } = require('../core.js');
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
  assert.equal(ui.status.textContent, '');
  ui.input.checked = false;
  await ui.change();
  assert.equal(saved.enabled, false);
  assert.equal(ui.status.textContent, '');
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

function content(get, { url = 'https://github.com/org/repo/pull/1/changes', navigation = true } = {}) {
  let listener;
  let starts = 0;
  let stops = 0;
  const settings = [];
  const local = { get };
  const document = new EventTarget();
  const window = new EventTarget();
  Object.assign(window, { setTimeout, clearTimeout });
  if (navigation) window.navigation = new EventTarget();
  const location = { href: url };
  const context = {
    chrome: { storage: { local, onChanged: { addListener: fn => { listener = fn; }, removeListener: () => { listener = null; } } } },
    GitHubTestViewed: {
      diffPageKey,
      createController: () => {
        starts++;
        return { setEnabled: value => settings.push(value), stop: () => { stops++; } };
      }
    },
    document, location, window,
    MutationObserver: function () {}, console: { warn() {} }
  };
  vm.runInNewContext(contentSource, context);
  return {
    settings, started: () => starts > 0, starts: () => starts, stops: () => stops,
    change: value => listener({ enabled: { newValue: value } }, 'local'),
    navigate(url, event = 'currententrychange') {
      location.href = url;
      const target = event === 'currententrychange' ? window.navigation
        : ['turbo:load', 'pjax:end'].includes(event) ? document : window;
      target.dispatchEvent(new Event(event));
    }
  };
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

for (const url of [
  'https://github.com/',
  'https://github.com/org/repo',
  'https://github.com/org/repo/pull/1',
  'https://github.com/org/repo/pull/1/files',
  'https://github.com/org/repo/pull/1/checks'
]) test(`content script stays inactive on ${url}`, async () => {
  const script = content(async defaults => defaults, { url });
  await flush();
  script.change(false);
  script.change(true);
  assert.equal(script.started(), false);
  assert.deepEqual(script.settings, []);
});

test('navigation starts one controller on Changes and stops it on exit', async () => {
  const script = content(async defaults => defaults, { url: 'https://github.com/org/repo' });
  await flush();
  script.navigate('https://github.com/org/repo/pull/1/changes');
  assert.equal(script.starts(), 1);
  assert.deepEqual(script.settings, [true]);
  script.navigate('https://github.com/org/repo/pull/1/changes?w=1');
  script.navigate('https://github.com/org/repo/pull/1/changes#diff-abc', 'turbo:load');
  script.change(false);
  script.change(true);
  assert.equal(script.starts(), 1);
  assert.equal(script.stops(), 0);
  script.navigate('https://github.com/org/repo/pull/1');
  assert.equal(script.stops(), 1);
  script.navigate('https://github.com/org/repo/pull/1/files');
  assert.equal(script.starts(), 1);
  assert.equal(script.stops(), 1);
  script.change(false);
  script.navigate('https://github.com/org/repo/pull/2/changes');
  assert.equal(script.starts(), 2);
  assert.equal(script.settings.at(-1), false);
});

for (const event of ['turbo:load', 'pjax:end', 'popstate', 'pageshow']) {
  test(`${event} updates scope without the Navigation API`, async () => {
    const script = content(async defaults => defaults, { url: 'https://github.com/org/repo', navigation: false });
    await flush();
    script.navigate('https://github.com/org/repo/pull/1/changes', event);
    assert.equal(script.starts(), 1);
    script.navigate('https://github.com/org/repo/pull/1', event);
    assert.equal(script.stops(), 1);
  });
}

test('startup uses the current route after the settings read', async () => {
  let resolveGet;
  const script = content(() => new Promise(resolve => { resolveGet = resolve; }));
  script.navigate('https://github.com/org/repo');
  resolveGet({ enabled: true });
  await flush();
  assert.equal(script.started(), false);
  script.navigate('https://github.com/org/repo/pull/1/changes');
  assert.equal(script.starts(), 1);
});
