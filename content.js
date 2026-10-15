(async function () {
  "use strict";
  let controller;
  let enabled = true;
  let settingsChanged = false;
  const onChange = (changes, area) => {
    if (area === "local" && changes.enabled) {
      settingsChanged = true;
      enabled = changes.enabled.newValue === undefined || changes.enabled.newValue === true;
      controller?.setEnabled(enabled);
    }
  };
  chrome.storage.onChanged.addListener(onChange);
  try {
    const saved = await chrome.storage.local.get({ enabled: true });
    if (!settingsChanged) enabled = saved.enabled === true;
    controller = GitHubTestViewed.createController({
      document,
      getUrl: () => location.href,
      MutationObserver,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window)
    });
    controller.setEnabled(enabled);
  } catch {
    chrome.storage.onChanged.removeListener(onChange);
    console.warn("gh-no-tests could not read its settings. Reload this tab.");
  }
})();
