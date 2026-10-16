/** Scroll window and scrollable ancestors to the top of a step view. */
export function scrollToStepTop(root?: HTMLElement | null): void {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  const start = root ?? document.body;
  let el: HTMLElement | null = start;
  while (el) {
    const { overflowY } = window.getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight
    ) {
      el.scrollTop = 0;
    }
    el = el.parentElement;
  }
}

/** Focus heading or first control inside an inline step, without scrolling the page. */
export function focusInlineStepTarget(scope: ParentNode): void {
  const heading = scope.querySelector<HTMLElement>("[data-step-heading]");
  const control = scope.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), button:not([disabled])',
  );
  const target = heading ?? control;
  if (!target || target.closest('[aria-hidden="true"]')) {
    return;
  }
  if (heading && heading.tabIndex < 0) {
    heading.tabIndex = -1;
  }
  target.focus({ preventScroll: true });
}

/** Move focus to the primary heading for the current step, if present. */
export function focusStepHeading(scope: ParentNode = document): void {
  const heading = scope.querySelector<HTMLElement>(
    "h2.hui-type-page-title, [data-step-heading], section h2, main h2, h2",
  );
  if (!heading || heading.closest('[aria-hidden="true"]')) {
    return;
  }
  if (heading.tabIndex < 0) {
    heading.tabIndex = -1;
  }
  heading.focus({ preventScroll: true });
}

export function scrollAndFocusStepTop(root?: HTMLElement | null): void {
  scrollToStepTop(root);
  window.requestAnimationFrame(() => {
    focusStepHeading(root ?? document);
  });
}
