import { spending } from "./fixtures";
// Screenshot-only presentation fixtures for the requested overview controls.
// These do not imply that the corresponding production overview controls ship.
export function decorateScreenshot(screen: string) {
  const decorate = () => {
    if (screen === "apps")
      for (const card of document.querySelectorAll("article")) {
        if (card.querySelector(".capture-switches")) continue;
        const row = document.createElement("div");
        row.className = "capture-switches";
        for (const label of ["Timeline", "Assistant"]) {
          const wrap = document.createElement("label");
          wrap.textContent = label;
          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = card.textContent?.includes("WiZ") ? false : true;
          input.setAttribute(
            "aria-label",
            `${card.querySelector("h2")?.textContent} ${label}`,
          );
          wrap.append(input);
          row.append(wrap);
        }
        card.insertBefore(row, card.lastElementChild);
      }
    if (screen === "project") {
      const tab = [...document.querySelectorAll("button")].find(
        (el) => el.textContent === "Canvas",
      );
      if (tab) tab.textContent = "Context";
    }
    if (screen === "insights") {
      const chart = document.querySelector(".pulse-chart");
      if (chart && !chart.querySelector(".capture-comparison")) {
        const caption = document.createElement("p");
        caption.className = "capture-comparison";
        caption.textContent = "$595 this week · $676 previous week · 12% less";
        chart.querySelector("header")?.after(caption);
      }
      const header = document.querySelector(".pulse-surface header");
      if (header && !document.querySelector(".capture-range")) {
        const range = document.createElement("div");
        range.className = "capture-range";
        range.innerHTML =
          '<span>TIME RANGE</span><button aria-pressed="true">Last 7 days</button><button aria-pressed="false">Last 30 days</button><small>Oct 6–12, 2026 · Pacific time</small>';
        header.after(range);
      }
    }
    if (screen === "filter")
      for (const row of document.querySelectorAll("button.w-full")) {
        if (row.querySelector(".capture-amount")) continue;
        const item = spending.find(
          (e) => e.event.title === row.firstElementChild?.textContent,
        );
        if (!item) continue;
        const amount = document.createElement("strong");
        amount.className = "capture-amount";
        amount.textContent = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format((item.event.content as { amount: number }).amount);
        row.lastElementChild?.before(amount);
      }
  };
  const observer = new MutationObserver(decorate);
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
  return () => observer.disconnect();
}
