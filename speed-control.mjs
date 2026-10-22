const mountedControls = new WeakMap();

let nextControlId = 0;

function optionLabel(option) {
  return (option.textContent || option.value || "").trim().replace(/\s+/g, " ");
}

function makeElement(document, tagName, className) {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

/**
 * Replace the existing playback-speed label with a custom, accessible menu.
 * The original select stays in the DOM as the source of truth for its value
 * and change event, including for existing automation that targets #speed.
 */
export function mountSpeedControl(selectElement) {
  if (!(selectElement instanceof Element) || selectElement.tagName !== "SELECT") {
    return null;
  }

  const mounted = mountedControls.get(selectElement);
  if (mounted) return mounted;

  const document = selectElement.ownerDocument;
  const oldLabel = selectElement.closest("label.playback-speed") || selectElement.parentElement;
  if (!oldLabel || !oldLabel.parentNode) return null;

  const wrapper = makeElement(document, "div", oldLabel.className || "playback-speed");
  for (const attribute of oldLabel.attributes) {
    if (attribute.name !== "class" && attribute.name !== "for") {
      wrapper.setAttribute(attribute.name, attribute.value);
    }
  }
  wrapper.classList.add("playback-speed", "speed-control");
  wrapper.dataset.speedControl = "";

  const trigger = makeElement(document, "button", "speed-trigger");
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");

  const triggerLabel = makeElement(document, "span", "speed-label");
  triggerLabel.textContent = "倍速";
  const currentValue = makeElement(document, "span", "speed-current");
  currentValue.setAttribute("aria-hidden", "true");
  const triggerChevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  triggerChevron.classList.add("speed-chevron");
  triggerChevron.setAttribute("viewBox", "0 0 16 16");
  triggerChevron.setAttribute("aria-hidden", "true");
  triggerChevron.innerHTML = '<path d="m4 6 4 4 4-4" />';
  trigger.append(triggerLabel, currentValue, triggerChevron);

  const menu = makeElement(document, "div", "speed-menu");
  menu.id = selectElement.id
    ? `${selectElement.id}-speed-menu`
    : `speed-menu-${++nextControlId}`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "倍速");
  menu.dataset.open = "false";
  trigger.setAttribute("aria-controls", menu.id);

  const nativeSelect = selectElement;
  nativeSelect.classList.add("speed-native-select");
  nativeSelect.tabIndex = -1;
  nativeSelect.setAttribute("aria-hidden", "true");
  nativeSelect.dataset.speedSource = "true";

  const optionButtons = Array.from(nativeSelect.options, (option, index) => {
    const item = makeElement(document, "button", "speed-option");
    item.type = "button";
    item.dataset.optionIndex = String(index);
    item.setAttribute("role", "menuitemradio");
    item.disabled = option.disabled;

    const label = makeElement(document, "span", "speed-option-label");
    label.textContent = optionLabel(option);
    const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    check.classList.add("speed-check");
    check.setAttribute("viewBox", "0 0 16 16");
    check.setAttribute("aria-hidden", "true");
    check.innerHTML = '<path d="m3.5 8.3 3 3 6-6.4" />';
    item.append(label, check);

    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chooseOption(index);
      closeMenu(true);
    });
    return item;
  });

  menu.append(...optionButtons);
  oldLabel.replaceWith(wrapper);
  wrapper.append(nativeSelect, trigger, menu);

  let isOpen = false;
  let usesPopover = typeof menu.showPopover === "function" && typeof menu.hidePopover === "function";
  if (usesPopover) menu.setAttribute("popover", "auto");
  let activeIndex = nativeSelect.selectedIndex;

  function syncFromSelect() {
    const selectedIndex = Math.max(0, nativeSelect.selectedIndex);
    const selectedOption = nativeSelect.options[selectedIndex];
    currentValue.textContent = selectedOption ? optionLabel(selectedOption) : "";
    trigger.setAttribute("aria-label", `倍速 ${currentValue.textContent}`.trim());
    optionButtons.forEach((button, index) => {
      button.setAttribute("aria-checked", String(index === nativeSelect.selectedIndex));
      button.tabIndex = index === nativeSelect.selectedIndex ? 0 : -1;
    });
    activeIndex = selectedIndex;
  }

  function chooseOption(index) {
    const option = nativeSelect.options[index];
    if (!option || option.disabled) return;
    nativeSelect.value = option.value;
    const EventConstructor = document.defaultView?.Event || Event;
    nativeSelect.dispatchEvent(new EventConstructor("change", { bubbles: true }));
    syncFromSelect();
  }

  function positionMenu() {
    if (!isOpen) return;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const controlRect = wrapper.getBoundingClientRect();
    const availableWidth = Math.max(1, viewportWidth - 16);
    const menuWidth = Math.min(controlRect.width, availableWidth);
    menu.style.width = `${menuWidth}px`;
    menu.style.maxWidth = `${availableWidth}px`;
    menu.style.left = "0px";
    menu.style.top = "0px";

    const menuHeight = menu.offsetHeight || menu.getBoundingClientRect().height;
    const left = Math.min(
      Math.max(controlRect.left, 8),
      Math.max(8, viewportWidth - menuWidth - 8),
    );
    let top = controlRect.top - menuHeight - 8;
    let side = "top";
    if (top < 8) {
      const belowTop = controlRect.bottom + 8;
      if (belowTop + menuHeight <= viewportHeight - 8) {
        top = belowTop;
        side = "bottom";
      } else {
        top = Math.max(8, viewportHeight - menuHeight - 8);
      }
    }
    top = Math.min(top, Math.max(8, viewportHeight - menuHeight - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.dataset.side = side;
  }

  function eventIsInside(event) {
    const path = event.composedPath?.() || [];
    return path.includes(wrapper) || path.includes(menu) || wrapper.contains(event.target) || menu.contains(event.target);
  }

  function onOutsidePointer(event) {
    if (!eventIsInside(event)) closeMenu(false);
  }

  function onFocusIn(event) {
    if (!eventIsInside(event)) closeMenu(false);
  }

  function onWindowBlur() {
    window.setTimeout(() => {
      if (isOpen && document.activeElement?.tagName === "IFRAME") closeMenu(false);
    }, 0);
  }

  function startOpenListeners() {
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onDocumentKeydown, true);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.addEventListener("blur", onWindowBlur);
  }

  function stopOpenListeners() {
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("keydown", onDocumentKeydown, true);
    window.removeEventListener("resize", positionMenu);
    window.removeEventListener("scroll", positionMenu, true);
    window.removeEventListener("blur", onWindowBlur);
  }

  function onPopoverToggle() {
    if (!usesPopover) return;
    const nextOpen = menu.matches(":popover-open");
    if (nextOpen === isOpen) return;
    isOpen = nextOpen;
    menu.dataset.open = String(nextOpen);
    trigger.setAttribute("aria-expanded", String(nextOpen));
    if (nextOpen) {
      positionMenu();
      startOpenListeners();
    } else {
      stopOpenListeners();
    }
  }

  function enabledIndices() {
    return optionButtons.reduce((indices, button, index) => {
      if (!button.disabled) indices.push(index);
      return indices;
    }, []);
  }

  function focusAndChoose(index) {
    if (index < 0 || !optionButtons[index] || optionButtons[index].disabled) return;
    activeIndex = index;
    chooseOption(index);
    optionButtons[index].focus({ preventScroll: true });
  }

  function onDocumentKeydown(event) {
    if (!isOpen) {
      if (event.target === trigger && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        openMenu(false);
        const enabled = enabledIndices();
        if (enabled.length) {
          const index = event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : Math.max(0, nativeSelect.selectedIndex);
          focusAndChoose(index);
        }
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }

    if (!menu.contains(event.target) && event.target !== trigger) return;
    const enabled = enabledIndices();
    if (!enabled.length) return;

    const focusedButton = event.target.closest?.(".speed-option");
    const focusedIndex = focusedButton ? Number(focusedButton.dataset.optionIndex) : activeIndex;
    let nextIndex = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      const current = enabled.indexOf(focusedIndex);
      nextIndex = enabled[(current + 1 + enabled.length) % enabled.length];
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      const current = enabled.indexOf(focusedIndex);
      nextIndex = enabled[(current - 1 + enabled.length) % enabled.length];
    } else if (event.key === "Home") {
      nextIndex = enabled[0];
    } else if (event.key === "End") {
      nextIndex = enabled[enabled.length - 1];
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusAndChoose(nextIndex);
    }
  }

  function openMenu(focusSelected = true) {
    if (isOpen) return;
    if (!usesPopover && menu.parentElement !== document.body) {
      document.body.append(menu);
    }

    isOpen = true;
    menu.dataset.open = "true";
    trigger.setAttribute("aria-expanded", "true");
    if (usesPopover) {
      try {
        menu.showPopover();
      } catch {
        usesPopover = false;
        menu.removeAttribute("popover");
        document.body.append(menu);
      }
    }
    positionMenu();
    startOpenListeners();

    if (focusSelected) {
      const selectedButton = optionButtons[nativeSelect.selectedIndex] || optionButtons[0];
      selectedButton?.focus({ preventScroll: true });
    }
  }

  function closeMenu(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    menu.dataset.open = "false";
    trigger.setAttribute("aria-expanded", "false");
    if (usesPopover && menu.matches(":popover-open")) {
      try {
        menu.hidePopover();
      } catch {
        // The menu may already have left the top layer during page teardown.
      }
    }
    stopOpenListeners();
    if (returnFocus) trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener("keydown", (event) => {
    if (isOpen || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    openMenu(false);
    const enabled = enabledIndices();
    if (!enabled.length) return;
    const index = event.key === "Home"
      ? enabled[0]
      : event.key === "End"
        ? enabled[enabled.length - 1]
        : Math.max(0, nativeSelect.selectedIndex);
    focusAndChoose(index);
  });

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) closeMenu(false);
    else openMenu(true);
  });
  menu.addEventListener("toggle", onPopoverToggle);
  menu.addEventListener("click", (event) => event.stopPropagation());
  nativeSelect.addEventListener("change", syncFromSelect);

  syncFromSelect();
  const controller = { element: wrapper, trigger, menu, select: nativeSelect };
  mountedControls.set(selectElement, controller);
  return controller;
}
