"use strict";
const enabledInput = document.getElementById("enabled");
const status = document.getElementById("status");
function showStatus(enabled) {
  status.textContent = enabled ? "On · Test files start as Viewed." : "Off · Automatic changes stop.";
}
chrome.storage.local.get({ enabled: true }).then(saved => {
  enabledInput.checked = saved.enabled === true;
  enabledInput.disabled = false;
  showStatus(enabledInput.checked);
}).catch(() => {
  status.textContent = "Could not read the setting. Open this panel again.";
});
enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  enabledInput.disabled = true;
  try {
    await chrome.storage.local.set({ enabled });
    showStatus(enabled);
  } catch {
    enabledInput.checked = !enabled;
    status.textContent = "Could not save the setting. Try again.";
  } finally {
    enabledInput.disabled = false;
  }
});
