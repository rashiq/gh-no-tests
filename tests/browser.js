"use strict";
(async () => {
  const fixtures = document.getElementById("fixtures");
  const results = document.getElementById("results");
  let url = "https://github.com/example/project/pull/1/changes";
  let passed = 0;
  let failed = 0;
  let serial = 0;
  const delay = () => new Promise(resolve => setTimeout(resolve, 350));
  function check(name, condition) {
    const li = document.createElement("li");
    li.textContent = `${condition ? "PASS" : "FAIL"} — ${name}`;
    li.className = condition ? "pass" : "fail";
    results.append(li);
    condition ? passed++ : failed++;
  }
  function file(path, { classic = false, checked = false, collapseOnView = false, disabled = false, comment = false, labelledToggle = false } = {}) {
    const section = document.createElement("section");
    const header = document.createElement("div");
    const body = document.createElement("pre");
    body.textContent = "+ changed file contents";
    if (comment) section.className = "markdown-body";
    const collapse = document.createElement("button");
    const tooltip = document.createElement("span");
    tooltip.id = `collapse-${serial++}`;
    tooltip.setAttribute("aria-hidden", "true");
    function setCollapseLabel(text) {
      if (labelledToggle) {
        collapse.setAttribute("aria-labelledby", tooltip.id);
        tooltip.textContent = text;
      } else {
        collapse.setAttribute("aria-label", text);
        collapse.textContent = text;
      }
    }
    setCollapseLabel("Collapse file");
    let collapseCount = 0;
    collapse.addEventListener("click", () => {
      const hidden = !body.hidden;
      body.hidden = hidden;
      setCollapseLabel(hidden ? "Expand file" : "Collapse file");
      collapseCount++;
    });
    const heading = document.createElement("h3");
    const link = document.createElement("a");
    link.href = "#diff-test";
    link.textContent = `\u200e${path}\u200e`;
    heading.append(link);
    const viewed = document.createElement(classic ? "input" : "button");
    let clickCount = 0;
    if (classic) {
      header.className = "file-header";
      header.setAttribute("data-path", path);
      viewed.type = "checkbox";
      viewed.className = "js-reviewed-checkbox";
      viewed.id = `viewed-${serial++}`;
      viewed.checked = checked;
    } else {
      viewed.setAttribute("aria-pressed", String(checked));
      viewed.setAttribute("aria-label", checked ? "Viewed" : "Not Viewed");
      viewed.textContent = "Viewed";
    }
    viewed.disabled = disabled;
    viewed.addEventListener("click", () => {
      clickCount++;
      if (!classic) {
        const next = viewed.getAttribute("aria-pressed") !== "true";
        viewed.setAttribute("aria-pressed", String(next));
        viewed.setAttribute("aria-label", next ? "Viewed" : "Not Viewed");
      }
      if (collapseOnView && GitHubTestViewed.viewState(viewed) && !body.hidden) collapse.click();
    });
    header.append(collapse, tooltip, heading, viewed);
    if (classic) {
      const label = document.createElement("label");
      label.htmlFor = viewed.id;
      label.textContent = "Viewed";
      header.append(label);
    }
    section.append(header, body);
    fixtures.append(section);
    return { section, header, viewed, collapse, tooltip, body, clicks: () => clickCount, collapses: () => collapseCount };
  }
  const controller = GitHubTestViewed.createController({
    document, getUrl: () => url, MutationObserver,
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window)
  });
  try {
    const linked = file("pkg/internal_handler_intg_test.go", { labelledToggle: true });
    const linkedSource = file("pkg/internal_handler.go", { labelledToggle: true });
    const linkedPrior = file("pkg/prior_test.go", { labelledToggle: true, checked: true });
    await delay();
    check("Tooltip label permits a Viewed click", linked.clicks() === 1 && GitHubTestViewed.viewState(linked.viewed));
    check("Tooltip label permits collapse", linked.body.hidden);
    check("Tooltip label leaves source unchanged", linkedSource.clicks() === 0 && !linkedSource.body.hidden);
    check("Tooltip label collapses a viewed file", linkedPrior.body.hidden && linkedPrior.clicks() === 0);
    linkedPrior.collapse.click();
    await delay();
    check("Tooltip label keeps manual expansion", !linkedPrior.body.hidden);
    const lateLabel = file("pkg/late_label_test.go", { labelledToggle: true });
    lateLabel.tooltip.firstChild.data = "";
    await delay();
    check("Missing tooltip label leaves the file unchanged", lateLabel.clicks() === 0);
    lateLabel.tooltip.firstChild.data = "Collapse file";
    await delay();
    check("Delayed tooltip text permits Viewed", lateLabel.clicks() === 1 && lateLabel.body.hidden);
    const modern = file("pkg/client/network_test.go");
    const source = file("pkg/client/network.go");
    const classic = file("src/test_client.py", { classic: true, collapseOnView: true });
    const comment = file("tests/untrusted.js", { comment: true });
    const prior = file("src/prior.test.ts", { checked: true });
    const disabled = file("tests/disabled.py", { disabled: true });
    const ruby = file("app/user_spec.rb");
    await delay();
    check("Modern Viewed button changes once", modern.clicks() === 1 && GitHubTestViewed.viewState(modern.viewed));
    check("Modern test diff collapses", modern.body.hidden);
    check("Source file stays open and unviewed", source.clicks() === 0 && !source.body.hidden);
    check("Classic checkbox changes once", classic.clicks() === 1 && classic.viewed.checked);
    check("Native collapse does not toggle twice", classic.body.hidden && classic.collapses() === 1);
    check("Comment controls stay unchanged", comment.clicks() === 0);
    check("Previously viewed test collapses without a Viewed click", prior.clicks() === 0 && prior.body.hidden);
    check("Disabled Viewed control stays unchanged", disabled.clicks() === 0);
    check("Ruby spec outside a spec directory matches", ruby.clicks() === 1);
    controller.scan();
    controller.scan();
    check("Repeated scans do not toggle Viewed", modern.clicks() === 1 && classic.clicks() === 1);
    modern.viewed.click();
    modern.collapse.click();
    await delay();
    check("Manual uncheck and expansion stay unchanged", !GitHubTestViewed.viewState(modern.viewed) && !modern.body.hidden && modern.clicks() === 2);
    modern.section.remove();
    const replacement = file("pkg/client/network_test.go");
    await delay();
    check("Manual choice survives a new DOM node", replacement.clicks() === 0);
    const late = file("tests/late.ts");
    disabled.viewed.disabled = false;
    await delay();
    check("Observer processes a delayed file", late.clicks() === 1 && late.body.hidden);
    check("Observer processes a control after GitHub enables it", disabled.clicks() === 1);
    prior.collapse.click();
    await delay();
    check("Manual expansion stays open", !prior.body.hidden);
    controller.setEnabled(false);
    const off = file("tests/off.ts");
    await delay();
    check("Off setting stops new changes", off.clicks() === 0);
    controller.setEnabled(true);
    await delay();
    check("On setting resumes new changes", off.clicks() === 1);
    check("On setting keeps manual choices", replacement.clicks() === 0);
    fixtures.replaceChildren();
    url = "https://github.com/example/project/pull/2/changes";
    const next = file("pkg/client/network_test.go");
    await delay();
    check("New pull request resets manual choices", next.clicks() === 1);
    fixtures.replaceChildren();
    url = "https://github.com/example/project/pull/2";
    const discussion = file("tests/discussion.py");
    await delay();
    check("Conversation route stays unchanged", discussion.clicks() === 0);
    url = "https://github.com/example/project/pull/2/files";
    document.dispatchEvent(new Event("turbo:load"));
    await delay();
    check("SPA entry into a diff starts processing", discussion.clicks() === 1);
    fixtures.replaceChildren();
    url = "https://example.com/example/project/pull/2/files";
    const otherHost = file("tests/host.py");
    await delay();
    check("Other host stays unchanged", otherHost.clicks() === 0);
    fixtures.replaceChildren();
    url = "https://github.com/example/project/pull/3/changes";
    const hidden = file("tests/hidden.py");
    hidden.section.hidden = true;
    await delay();
    check("Hidden file stays unchanged", hidden.clicks() === 0);
    hidden.section.hidden = false;
    await delay();
    check("Revealed file receives Viewed", hidden.clicks() === 1);
    const unknown = file("tests/unknown.py");
    unknown.viewed.removeAttribute("aria-pressed");
    await delay();
    check("Unknown control state stays unchanged", unknown.clicks() === 0);
    const bulk = document.createElement("button");
    bulk.setAttribute("aria-pressed", "false");
    bulk.setAttribute("aria-label", "Mark all as viewed");
    fixtures.append(bulk);
    check("Bulk Viewed control is excluded", GitHubTestViewed.fileContext(bulk) === null);
  } catch (error) {
    check(`Unexpected error: ${error.message}`, false);
  } finally {
    controller.stop();
    fixtures.replaceChildren();
    document.getElementById("summary").textContent = `${passed} passed; ${failed} failed.`;
  }
})();
