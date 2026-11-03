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
    function syncController() {
      if (!GitHubTestViewed.diffPageKey(location.href)) {
        controller?.stop();
        controller = undefined;
        return;
      }
      if (!controller) {
        controller = GitHubTestViewed.createController({
          document,
          getUrl: () => location.href,
          MutationObserver,
          setTimeout: window.setTimeout.bind(window),
          clearTimeout: window.clearTimeout.bind(window)
        });
      }
      controller.setEnabled(enabled);
    }
    // GitHub can enter or leave a diff without a document reload.
    document.addEventListener("turbo:load", syncController);
    document.addEventListener("pjax:end", syncController);
    window.addEventListener("popstate", syncController);
    window.addEventListener("pageshow", syncController);
    window.navigation?.addEventListener("currententrychange", syncController);
    syncController();
  } catch {
    chrome.storage.onChanged.removeListener(onChange);
    console.warn("gh-no-tests could not read its settings. Reload this tab.");
  }
})();
