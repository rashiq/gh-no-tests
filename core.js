(function (root) {
  "use strict";

  const CONTROLS = 'input[type="checkbox"], button[aria-pressed], [role="checkbox"][aria-checked]';
  const EXCLUDED = '.markdown-body, .comment-body, .js-comment-body, table, pre, code, [role="tree"], [role="dialog"]';
  const HEADINGS = 'h1 a, h2 a, h3 a, h4 a, [role="heading"] a';

  function cleanPath(value) {
    return (value || "").replace(/^[\u200e\u200f\u2066-\u2069\s]+|[\u200e\u200f\u2066-\u2069\s]+$/g, "");
  }

  function isTestFile(value) {
    if (typeof value !== "string" || !value) return false;
    const parts = value.replace(/\\/g, "/").split("/");
    const name = parts.pop();
    if (parts.some(part =>
      /^(?:tests?|specs?|__tests__|__snapshots__|__fixtures__|test[_-]?(?:data|utils?|helpers?|fixtures?)|e2e|cypress|evals|hurl|k6|(?:unit|integration|acceptance|functional|e2e)[_-]?tests?)$/i.test(part) ||
      /[-_]e2e$/i.test(part) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?-snapshots$/i.test(part)
    )) return true;
    if (/\.(?:test|spec|cy|eval|bench|benchmark)\.[^.]+(?:\.snap)?$/i.test(name)) return true;
    if (/\.hurl$/i.test(name) || /\.tftest\.(?:hcl|json)$/i.test(name)) return true;
    if (/(?:^|[_-])tests?\.(?:go|py|rb|rs|exs?|php|c|cc|cpp|cxx|h|hpp|sh|clj|cljs|dart|[cm]?[jt]sx?)$/i.test(name)) return true;
    if (/^test[_-].+\.(?:py|rb|php|c|cc|cpp|sh|[cm]?[jt]sx?)$/i.test(name)) return true;
    if (/^(?:conftest\.py|pytest\.ini)$/i.test(name)) return true;
    if (/^(?:vitest|jest|playwright|cypress)\.(?:config|setup|global-setup|global-teardown)\.[cm]?[jt]s$/i.test(name)) return true;
    if (/^playwright[-_].+\.[cm]?[jt]s$/i.test(name)) return true;
    if (/^(?:bench|benchmark)[-_].+\.(?:[cm]?[jt]s|py|sh)$/i.test(name)) return true;
    if (/[-_](?:bench|benchmark)\.(?:[cm]?[jt]s|py|sh)$/i.test(name)) return true;
    if (/(?:^|_)test[_-](?:utils?|helpers?)\.(?:go|py)$/i.test(name)) return true;
    if (/_spec\.rb$/i.test(name)) return true;
    return /^(?:Test[A-Z].*|.+(?:Test|Tests|Spec))\.(?:java|kt|kts|scala|cs|fs|swift|php)$/.test(name);
  }

  function diffPageKey(value) {
    try {
      const url = new URL(value);
      if (url.origin !== "https://github.com") return null;
      if (!/^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/[^/]+)*\/?$/.test(url.pathname)) return null;
      // Keep choices across filters and anchors.
      return url.pathname.replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  function viewedControl(element) {
    if (!element.matches(CONTROLS) || element.closest(EXCLUDED)) return false;
    if (element.matches('input.js-reviewed-checkbox, input[name="viewed"]')) return true;
    const labels = [element.getAttribute("aria-label"), element.getAttribute("title")];
    if (element.labels) labels.push(...Array.from(element.labels, label => label.textContent));
    if (element.tagName !== "INPUT") labels.push(element.textContent);
    return labels.some(label => /^(?:not viewed|viewed|mark (?:file )?as (?:unviewed|viewed))$/i.test((label || "").trim()));
  }

  function viewState(element) {
    if (element.matches('input[type="checkbox"]')) return element.checked;
    const value = element.getAttribute("aria-checked") ?? element.getAttribute("aria-pressed");
    return value === "true" ? true : value === "false" ? false : null;
  }

  function controlLabel(element) {
    const ids = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    const linked = ids.map(id => element.ownerDocument.getElementById(id)?.textContent || "").join(" ").trim();
    return (linked || element.getAttribute("aria-label") || element.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  }

  function fileToggle(header, collapseOnly = false) {
    return Array.from(header.querySelectorAll('button[aria-label], button[aria-labelledby]')).find(button => {
      const label = controlLabel(button);
      return label === "Collapse file" || (!collapseOnly && label === "Expand file");
    });
  }

  function fileContext(control) {
    if (!viewedControl(control)) return null;
    for (let header = control.parentElement, depth = 0; header && depth < 8; header = header.parentElement, depth++) {
      if (header.matches('body, main, [role="main"]')) break;
      const controls = Array.from(header.querySelectorAll(CONTROLS)).filter(viewedControl);
      if (controls.length > 1) break;

      // Classic headers expose the file path.
      if (header.matches('.file-header, [data-testid="file-header"]')) {
        const pathNode = header.matches('[data-path]') ? header : header.querySelector('[data-path]');
        const file = header.closest('.file[data-path], [data-file-path]');
        const path = cleanPath(pathNode?.getAttribute("data-path") || file?.getAttribute("data-path") || file?.getAttribute("data-file-path"));
        if (path) return { header, path };
      }

      // New headers use a file link and collapse button.
      const collapse = fileToggle(header);
      const links = header.querySelectorAll(HEADINGS);
      if (collapse && links.length === 1) {
        const link = links[0];
        const path = cleanPath(link.getAttribute("data-path") || link.getAttribute("title") || link.textContent);
        if (path && !path.includes("\n")) return { header, path };
      }
    }
    return null;
  }

  function usable(control) {
    return control.isConnected && !control.matches(':disabled, [aria-disabled="true"]') && !control.closest('[hidden], [inert], [aria-hidden="true"]');
  }

  function collapseFile(header) {
    const button = fileToggle(header, true) || header.querySelector('.js-details-target[aria-expanded="true"]');
    if (button && usable(button)) button.click();
  }

  function createController({ document, getUrl, MutationObserver, setTimeout, clearTimeout }) {
    let enabled = true;
    let pageKey = null;
    let timer = null;
    let stopped = false;
    // Keep choices after React replaces file nodes.
    const handled = new Set();
    const manual = new Set();
    const pending = new Map();
    const ownClicks = new WeakSet();

    function syncRoute() {
      const next = diffPageKey(getUrl());
      if (next !== pageKey) {
        pageKey = next;
        handled.clear();
        manual.clear();
        pending.clear();
      }
      return next;
    }

    function scan() {
      timer = null;
      if (stopped || !syncRoute() || !enabled) return;
      const controls = Array.from(document.querySelectorAll(CONTROLS));
      for (const control of controls) {
        const context = fileContext(control);
        if (!context || !isTestFile(context.path) || !usable(control)) continue;
        const { path, header } = context;
        if (manual.has(path)) continue;
        const state = viewState(control);
        if (pending.has(path)) {
          if (state === true) {
            pending.delete(path);
            collapseFile(header);
          } else if (Date.now() > pending.get(path)) {
            pending.delete(path); // Do not retry failed updates.
          }
          continue;
        }
        if (handled.has(path) || state === null) continue;
        handled.add(path);
        if (state === true) {
          collapseFile(header);
          continue;
        }
        pending.set(path, Date.now() + 5000);
        ownClicks.add(control);
        try {
          control.click();
        } finally {
          ownClicks.delete(control);
        }
        // Input properties can change without attributes.
        schedule();
      }
    }

    function schedule() {
      if (!stopped && timer === null) timer = setTimeout(scan, 150);
    }

    function onClick(event) {
      if (!syncRoute()) return;
      let target = event.target;
      if (!target?.closest) return;
      const label = target.closest("label");
      target = target.closest(CONTROLS) || label?.control;
      if (!target || ownClicks.has(target)) return;
      const context = fileContext(target);
      if (context) {
        manual.add(context.path);
        pending.delete(context.path);
      }
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["aria-pressed", "aria-checked", "aria-label", "aria-labelledby", "aria-disabled", "disabled", "checked", "data-path", "title", "href", "hidden", "inert", "aria-hidden"]
    });
    document.addEventListener("click", onClick, true);
    document.addEventListener("turbo:load", schedule);
    document.addEventListener("pjax:end", schedule);
    document.defaultView?.addEventListener("popstate", schedule);
    document.defaultView?.addEventListener("pageshow", schedule);
    schedule();

    return {
      scan,
      setEnabled(value) {
        enabled = value === true;
        if (!enabled) pending.clear();
        schedule();
      },
      stop() {
        stopped = true;
        if (timer !== null) clearTimeout(timer);
        observer.disconnect();
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("turbo:load", schedule);
        document.removeEventListener("pjax:end", schedule);
        document.defaultView?.removeEventListener("popstate", schedule);
        document.defaultView?.removeEventListener("pageshow", schedule);
      }
    };
  }

  const api = { isTestFile, diffPageKey, fileContext, viewState, createController };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GitHubTestViewed = api;
})(globalThis);
