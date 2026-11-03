"use strict";
const enabledInput = document.getElementById("enabled");
const status = document.getElementById("status");
chrome.storage.local.get({ enabled: true }).then(saved => {
  enabledInput.checked = saved.enabled === true;
  enabledInput.disabled = false;
  status.textContent = "";
}).catch(() => {
  status.textContent = "Could not read the setting.";
});
enabledInput.addEventListener("change", async () => {
  const enabled = enabledInput.checked;
  enabledInput.disabled = true;
  try {
    await chrome.storage.local.set({ enabled });
    status.textContent = "";
  } catch {
    enabledInput.checked = !enabled;
    status.textContent = "Could not save the setting.";
  } finally {
    enabledInput.disabled = false;
  }
});
