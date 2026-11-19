(function () {
  "use strict";

  var STORAGE_KEY = "crumb-and-co-cart-v1";
  var MAX_QUANTITY = 99;
  var MAX_UNIT_PRICE_CENTS = 1000000;
  var MOBILE_NAV_QUERY = "(max-width: 860px)";
  var SECTION_IDS = ["home", "cookies", "about", "reviews", "contact"];

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function nextFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(callback, 0);
  }

  function scrollToElement(element, behavior) {
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: behavior, block: "start" });
      return;
    }
    if (element && typeof window.scrollTo === "function") {
      var top = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top);
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function isElement(node) {
    return Boolean(node && typeof node === "object" && node.nodeType === 1);
  }

  function closestElement(target, selector) {
    if (!isElement(target)) {
      return null;
    }
    return target.closest(selector);
  }

  function parsePriceToCents(value) {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) {
        return null;
      }
      var rounded = Math.round(value * 100);
      return Number.isSafeInteger(rounded) &&
        rounded > 0 &&
        rounded <= MAX_UNIT_PRICE_CENTS
        ? rounded
        : null;
    }

    if (typeof value !== "string") {
      return null;
    }

    var normalized = value.trim().replace(/^\$/, "").replace(/,/g, "");
    var match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      return null;
    }

    var whole = Number(match[1]);
    var fractional = Number((match[2] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fractional)) {
      return null;
    }

    var cents = whole * 100 + fractional;
    return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_UNIT_PRICE_CENTS
      ? cents
      : null;
  }

  function normalizeStoredPrice(value) {
    return Number.isSafeInteger(value) &&
      value > 0 &&
      value <= MAX_UNIT_PRICE_CENTS
      ? value
      : null;
  }

  function normalizeQuantity(value) {
    return Number.isSafeInteger(value) && value > 0 && value <= MAX_QUANTITY
      ? value
      : null;
  }

  function normalizeText(value, maximumLength) {
    if (typeof value !== "string") {
      return null;
    }
    var text = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
    if (!text || text.length > maximumLength) {
      return null;
    }
    return text;
  }

  function normalizeImagePath(value) {
    var path = normalizeText(value, 500);
    if (!path) {
      return "";
    }

    if (
      /^[a-z][a-z0-9+.-]*:/i.test(path) ||
      path.startsWith("//") ||
      path.includes("\\") ||
      path.split("/").some(function (part) {
        return part === "..";
      })
    ) {
      return "";
    }

    return path;
  }

  function calculateCartQuantity(items) {
    return items.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function calculateCartSubtotal(items) {
    return items.reduce(function (sum, item) {
      return sum + item.priceCents * item.quantity;
    }, 0);
  }

  function validateStoredCart(value, catalog) {
    if (!catalog || typeof catalog.get !== "function") {
      catalog = new Map();
    }
    var source;
    if (Array.isArray(value)) {
      source = value;
    } else if (
      value &&
      typeof value === "object" &&
      Array.isArray(value.items)
    ) {
      source = value.items;
    } else {
      return { items: [], rejected: 1, fatal: true };
    }

    if (source.length > 100) {
      return { items: [], rejected: source.length, fatal: true };
    }

    var items = [];
    var indexes = new Map();
    var rejected = 0;

    source.forEach(function (candidate) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        rejected += 1;
        return;
      }

      var id = normalizeText(candidate.id, 100);
      var name = normalizeText(candidate.name, 160);
      var priceCents = normalizeStoredPrice(candidate.priceCents);
      if (priceCents === null && candidate.priceCents == null && candidate.price != null) {
        priceCents = parsePriceToCents(candidate.price);
      }
      var quantity = normalizeQuantity(candidate.quantity);
      if (!id || !name || priceCents === null || quantity === null) {
        rejected += 1;
        return;
      }

      var authoritative = catalog.get(id);
      if (!authoritative) {
        rejected += 1;
        return;
      }
      var image = normalizeImagePath(candidate.image);
      name = authoritative.name;
      priceCents = authoritative.priceCents;
      image = authoritative.image;

      if (indexes.has(id)) {
        var existing = items[indexes.get(id)];
        var combined = existing.quantity + quantity;
        if (combined > MAX_QUANTITY) {
          rejected += 1;
          existing.quantity = MAX_QUANTITY;
        } else {
          existing.quantity = combined;
        }
        return;
      }

      indexes.set(id, items.length);
      items.push({
        id: id,
        name: name,
        priceCents: priceCents,
        image: image,
        quantity: quantity,
      });
    });

    return { items: items, rejected: rejected, fatal: false };
  }

  function formatMoney(cents) {
    var safeCents = Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
    return "$" + (safeCents / 100).toFixed(2);
  }

  onReady(function initializeShop() {
    var toastRegion = byId("toast-region");
    var cartToggle = byId("cart-toggle");
    var cartCount = byId("cart-count");
    var cartBackdrop = byId("cart-backdrop");
    var cartDrawer = byId("cart-drawer");
    var cartLayer =
      cartDrawer && cartDrawer.closest ? cartDrawer.closest(".cart-layer") : null;
    var cartItemsElement = byId("cart-items");
    var cartEmpty = byId("cart-empty");
    var cartSubtotal = byId("cart-subtotal");
    var checkoutButton = byId("checkout-button");
    var cartClose = byId("cart-close");
    var checkoutDialog = byId("checkout-dialog");
    var checkoutForm = byId("checkout-form");
    var checkoutOrderSummary = byId("checkout-order-summary");
    var checkoutTotal = byId("checkout-total");
    var checkoutClose = byId("checkout-close");
    var checkoutDone = byId("checkout-done");
    var checkoutConfirmation = byId("checkout-confirmation");
    var newsletterForm = byId("newsletter-form");
    var newsletterEmail = byId("newsletter-email");
    var newsletterStatus = byId("newsletter-status");
    if (cartCount) {
      cartCount.setAttribute("aria-atomic", "true");
    }
    if (cartSubtotal) {
      cartSubtotal.setAttribute("aria-live", "polite");
      cartSubtotal.setAttribute("aria-atomic", "true");
    }
    if (checkoutTotal) {
      checkoutTotal.setAttribute("aria-live", "polite");
      checkoutTotal.setAttribute("aria-atomic", "true");
    }
    var reducedMotionQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : { matches: false };

    function ensureToastRegion() {
      if (toastRegion && document.contains(toastRegion)) {
        return toastRegion;
      }

      toastRegion = document.createElement("div");
      toastRegion.id = "toast-region";
      toastRegion.className = "toast-region";
      toastRegion.setAttribute("role", "status");
      toastRegion.setAttribute("aria-live", "polite");
      toastRegion.setAttribute("aria-atomic", "false");
      document.body.appendChild(toastRegion);
      return toastRegion;
    }

    function showToast(message, variant) {
      var region = ensureToastRegion();
      var kind = variant === "warning" || variant === "error" ? variant : "success";
      var toast = document.createElement("div");
      toast.className = "toast toast--" + kind;
      toast.classList.add(kind);
      toast.classList.add("is-visible");
      toast.setAttribute("role", kind === "error" ? "alert" : "status");
      toast.textContent = message;
      region.appendChild(toast);

      var existing = Array.from(region.querySelectorAll(".toast"));
      while (existing.length > 4) {
        existing.shift().remove();
      }

      window.setTimeout(function () {
        toast.classList.remove("is-visible");
        toast.classList.add("is-hiding");
        window.setTimeout(function () {
          toast.remove();
        }, reducedMotionQuery.matches ? 0 : 220);
      }, kind === "success" ? 3000 : 6500);
    }

    function initializeNavigation() {
      var navToggle = byId("nav-toggle");
      var siteNav = byId("site-nav");
      var mobileNavigationQuery = window.matchMedia
        ? window.matchMedia(MOBILE_NAV_QUERY)
        : { matches: false };
      var menuOpen = false;
      var navLinks = siteNav
        ? Array.from(siteNav.querySelectorAll('a[href^="#"]'))
        : [];
      var sections = SECTION_IDS.map(byId).filter(Boolean);

      function setMenu(open, restoreFocus) {
        menuOpen = Boolean(open);
        if (siteNav) {
          siteNav.classList.toggle("is-open", menuOpen);
          siteNav.classList.toggle("open", menuOpen);
          siteNav.setAttribute("aria-hidden", mobileNavigationQuery.matches && !menuOpen ? "true" : "false");
          if ("inert" in siteNav) {
            siteNav.inert = mobileNavigationQuery.matches && !menuOpen;
          }
        }
        if (navToggle) {
          navToggle.setAttribute("aria-expanded", String(menuOpen));
          navToggle.setAttribute(
            "aria-label",
            menuOpen ? "Close navigation" : "Open navigation"
          );
          navToggle.classList.toggle("is-open", menuOpen);
          if (restoreFocus && !menuOpen) {
            navToggle.focus();
          }
        }
        document.body.classList.toggle("nav-open", menuOpen && mobileNavigationQuery.matches);
      }

      function setActiveSection(id) {
        navLinks.forEach(function (link) {
          var targetId = link.getAttribute("href").slice(1);
          var active = targetId === id;
          link.classList.toggle("is-active", active);
          link.classList.toggle("active", active);
          if (active) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      }

      function updateActiveSection() {
        document.body.classList.toggle("is-scrolled", window.scrollY > 12);
        if (!sections.length) {
          return;
        }

        var header = document.querySelector(".site-header, header");
        var offset = (header ? header.offsetHeight : 80) + 48;
        var activeSection = sections[0];
        var nearBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 24;

        if (nearBottom) {
          activeSection = sections[sections.length - 1];
        } else {
          sections.forEach(function (section) {
            if (section.getBoundingClientRect().top <= offset) {
              activeSection = section;
            }
          });
        }
        setActiveSection(activeSection.id);
      }

      function handleViewportChange() {
        if (!mobileNavigationQuery.matches) {
          setMenu(false, false);
        } else if (!menuOpen) {
          setMenu(false, false);
        }
      }

      if (navToggle && siteNav) {
        navToggle.setAttribute("aria-controls", "site-nav");
        setMenu(false, false);
        navToggle.addEventListener("click", function () {
          setMenu(!menuOpen, false);
        });
        document.addEventListener("click", function (event) {
          if (
            menuOpen &&
            !siteNav.contains(event.target) &&
            !navToggle.contains(event.target)
          ) {
            setMenu(false, false);
          }
        });
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && menuOpen) {
            event.preventDefault();
            setMenu(false, true);
          }
        });
        if (typeof mobileNavigationQuery.addEventListener === "function") {
          mobileNavigationQuery.addEventListener("change", handleViewportChange);
        } else if (typeof mobileNavigationQuery.addListener === "function") {
          mobileNavigationQuery.addListener(handleViewportChange);
        }
      }

      document.addEventListener("click", function (event) {
        var anchor = closestElement(event.target, 'a[href^="#"]');
        if (!anchor || anchor.target || event.defaultPrevented) {
          return;
        }
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        var id = anchor.getAttribute("href").slice(1);
        if (!id) {
          return;
        }
        var decodedId;
        try {
          decodedId = decodeURIComponent(id);
        } catch (error) {
          return;
        }
        var target = byId(decodedId);
        if (!target) {
          return;
        }

        event.preventDefault();
        if (drawerOpen) {
          closeCart({ immediate: true });
        }
        setMenu(false, false);
        scrollToElement(
          target,
          reducedMotionQuery.matches ? "auto" : "smooth"
        );
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        nextFrame(function () {
          if (typeof target.focus === "function") {
            try {
              target.focus({ preventScroll: true });
            } catch (error) {
              target.focus();
            }
          }
        });
        setActiveSection(decodedId);
        try {
          window.history.pushState(null, "", "#" + decodedId);
        } catch (error) {
          window.location.hash = decodedId;
        }
      });

      var scrollScheduled = false;
      window.addEventListener(
        "scroll",
        function () {
          if (scrollScheduled) {
            return;
          }
          scrollScheduled = true;
          nextFrame(function () {
            updateActiveSection();
            scrollScheduled = false;
          });
        },
        { passive: true }
      );
      window.addEventListener("resize", updateActiveSection, { passive: true });
      updateActiveSection();

      return {
        close: function closeNavigationMenu() {
          setMenu(false, false);
        },
        activate: setActiveSection,
      };
    }

    function initializeRevealAnimations() {
      var revealCandidates = Array.from(
        document.querySelectorAll(
          "[data-reveal], .reveal, .reveal-on-scroll, .collection-heading, .product-card, .story-media, .story-copy, .reviews-heading, .review-card, .contact-copy, .newsletter-card"
        )
      ).filter(function (element, index, all) {
        return all.indexOf(element) === index;
      });

      if (!revealCandidates.length) {
        return;
      }

      document.documentElement.classList.add("has-reveal-js");
      revealCandidates.forEach(function (element, index) {
        element.classList.add("reveal");
        element.setAttribute("data-reveal", "");
        if (!element.hasAttribute("data-reveal-delay")) {
          element.setAttribute(
            "data-reveal-delay",
            String(Math.min((index % 3) * 80, 160))
          );
        }
      });
      var elements = revealCandidates;

      elements.forEach(function (element) {
        var delay = Number(element.getAttribute("data-reveal-delay"));
        if (Number.isFinite(delay) && delay >= 0) {
          element.style.setProperty("--reveal-delay", Math.min(delay, 800) + "ms");
        }
      });

      function reveal(element) {
        element.classList.add("is-visible", "is-revealed", "revealed");
        element.setAttribute("data-revealed", "true");
      }

      if (
        reducedMotionQuery.matches ||
        typeof window.IntersectionObserver !== "function"
      ) {
        elements.forEach(reveal);
        return;
      }

      var revealStyle = document.createElement("style");
      revealStyle.setAttribute("data-crumb-reveal-styles", "");
      revealStyle.textContent =
        ".has-reveal-js [data-reveal]:not(.is-visible){opacity:0}" +
        ".has-reveal-js [data-reveal].is-visible{animation:crumb-reveal-in 650ms var(--reveal-delay,0ms) both cubic-bezier(.2,.8,.2,1)}" +
        "@keyframes crumb-reveal-in{from{opacity:0;translate:0 22px}to{opacity:1;translate:0 0}}";
      (document.head || document.documentElement).appendChild(revealStyle);

      var observer = new window.IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              return;
            }
            reveal(entry.target);
            observer.unobserve(entry.target);
          });
        },
        {
          root: null,
          rootMargin: "0px 0px -10% 0px",
          threshold: 0.12,
        }
      );

      elements.forEach(function (element) {
        observer.observe(element);
      });

      function handleMotionPreferenceChange(event) {
        if (!event.matches) {
          return;
        }
        observer.disconnect();
        elements.forEach(reveal);
      }

      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", handleMotionPreferenceChange);
      } else if (typeof reducedMotionQuery.addListener === "function") {
        reducedMotionQuery.addListener(handleMotionPreferenceChange);
      }
    }

    var navigation = initializeNavigation();
    initializeRevealAnimations();

    var catalog = new Map();
    var addButtons = Array.from(document.querySelectorAll(".add-to-cart"));

    function productFromButton(button) {
      var id = normalizeText(button.dataset.productId, 100);
      var name = normalizeText(button.dataset.name, 160);
      var explicitCents = normalizeStoredPrice(
        button.dataset.priceCents ? Number(button.dataset.priceCents) : null
      );
      var priceCents =
        explicitCents === null ? parsePriceToCents(button.dataset.price) : explicitCents;
      var image = normalizeImagePath(button.dataset.image || "");
      if (!id || !name || priceCents === null) {
        return null;
      }
      return {
        id: id,
        name: name,
        priceCents: priceCents,
        image: image,
        quantity: 1,
      };
    }

    addButtons.forEach(function (button) {
      var product = productFromButton(button);
      if (product) {
        catalog.set(product.id, product);
      }
      button.setAttribute("type", button.getAttribute("type") || "button");
    });

    var cart = [];
    var storage = null;
    var storageAvailable = false;
    var storageNotice = null;
    var storageLoadWarning = "";
    var storageNeedsRewrite = false;
    var initialStorageValue = null;

    function exposeStorageWarning(message) {
      if (!message) {
        return;
      }
      if (storageNotice && storageNotice.textContent === message) {
        return;
      }

      if (!storageNotice) {
        storageNotice = byId("cart-storage-warning");
      }
      if (!storageNotice) {
        storageNotice = document.createElement("p");
        storageNotice.id = "cart-storage-warning";
        storageNotice.className = "cart-storage-warning form-status is-warning";
        storageNotice.setAttribute("role", "status");
        storageNotice.style.margin = "0 0 1rem";
        storageNotice.style.padding = "0.75rem 1rem";
        storageNotice.style.borderRadius = "0.75rem";
        storageNotice.style.background = "rgba(180, 88, 30, 0.12)";
        storageNotice.style.color = "inherit";
        if (cartItemsElement && cartItemsElement.parentNode) {
          cartItemsElement.parentNode.insertBefore(storageNotice, cartItemsElement);
        } else if (cartDrawer) {
          cartDrawer.insertBefore(storageNotice, cartDrawer.firstChild);
        } else {
          document.body.appendChild(storageNotice);
        }
      }
      storageNotice.textContent = message;
      storageNotice.hidden = false;
      showToast(message, "warning");
    }

    try {
      storage = window.localStorage;
      initialStorageValue = storage.getItem(STORAGE_KEY);
      var probeKey =
        STORAGE_KEY + "-availability-probe-" + Date.now().toString(36);
      storage.setItem(probeKey, "1");
      storage.removeItem(probeKey);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
      storageLoadWarning =
        "Cart saving is unavailable in this browser. Your cart still works, but it will reset when this page closes.";
    }

    if (initialStorageValue !== null) {
      try {
        var parsed = JSON.parse(initialStorageValue);
        var validation = validateStoredCart(parsed, catalog);
        cart = validation.items;
        if (validation.fatal) {
          storageLoadWarning =
            "Saved cart data was not valid and has been reset. You can keep shopping normally.";
          storageNeedsRewrite = true;
        } else if (validation.rejected > 0) {
          storageLoadWarning =
            "Some saved cart items were invalid and were safely removed. The rest of your cart is ready.";
          storageNeedsRewrite = true;
        } else if (!Array.isArray(parsed) || parsed.version !== 1) {
          storageNeedsRewrite = true;
        }
      } catch (error) {
        cart = [];
        storageLoadWarning =
          "Saved cart data could not be read and was reset. You can keep shopping normally.";
        storageNeedsRewrite = true;
      }
    }

    if (storageLoadWarning) {
      exposeStorageWarning(storageLoadWarning);
    }

    function persistCart() {
      if (!storageAvailable || !storage) {
        exposeStorageWarning(
          "Cart saving is unavailable in this browser. Your cart still works, but it will reset when this page closes."
        );
        return false;
      }

      try {
        var serialized = JSON.stringify({
          version: 1,
          items: cart.map(function (item) {
            return {
              id: item.id,
              name: item.name,
              priceCents: item.priceCents,
              image: item.image,
              quantity: item.quantity,
            };
          }),
        });
        storage.setItem(
          STORAGE_KEY,
          serialized
        );
        initialStorageValue = serialized;
        return true;
      } catch (error) {
        storageAvailable = false;
        exposeStorageWarning(
          "Your cart could not be saved. It will keep working for this visit, but changes may be lost when you leave."
        );
        return false;
      }
    }

    var drawerOpen = false;
    var drawerCloseTimer = 0;
    var previouslyFocusedElement = null;
    var pageInertStates = [];
    var savedBodyOverflow = "";

    function focusableElements(root) {
      if (!root) {
        return [];
      }
      return Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (element) {
        return (
          element.getAttribute("aria-hidden") !== "true" &&
          !element.hidden &&
          !element.closest("[hidden], [aria-hidden='true']")
        );
      });
    }

    function setBackgroundInert(active) {
      if (active) {
        if (pageInertStates.length) {
          return;
        }
        Array.from(document.body.children).forEach(function (child) {
          if (
            child === cartDrawer ||
            child === cartBackdrop ||
            child === cartLayer ||
            child === toastRegion ||
            child === checkoutDialog ||
            (cartDrawer && child.contains(cartDrawer)) ||
            (cartBackdrop && child.contains(cartBackdrop))
          ) {
            return;
          }
          if ("inert" in child) {
            pageInertStates.push({ element: child, value: child.inert });
            child.inert = true;
          }
        });
      } else {
        pageInertStates.forEach(function (state) {
          state.element.inert = state.value;
        });
        pageInertStates = [];
      }
    }

    function openCart() {
      if (!cartDrawer || drawerOpen) {
        return;
      }
      navigation.close();
      if (toastRegion) {
        toastRegion.replaceChildren();
      }
      window.clearTimeout(drawerCloseTimer);
      drawerOpen = true;
      previouslyFocusedElement = document.activeElement;
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.body.classList.add("cart-open");
      if (cartLayer) {
        cartLayer.setAttribute("aria-hidden", "false");
      }
      cartDrawer.hidden = false;
      cartDrawer.classList.add("is-open", "open");
      cartDrawer.setAttribute("aria-hidden", "false");
      if (cartBackdrop) {
        cartBackdrop.hidden = false;
        cartBackdrop.classList.add("is-open", "open");
        cartBackdrop.setAttribute("aria-hidden", "false");
      }
      if (cartToggle) {
        cartToggle.setAttribute("aria-expanded", "true");
      }
      setBackgroundInert(true);

      nextFrame(function () {
        if (cartClose) {
          cartClose.focus();
        } else {
          var first = focusableElements(cartDrawer)[0];
          if (first) {
            first.focus();
          } else {
            cartDrawer.setAttribute("tabindex", "-1");
            cartDrawer.focus();
          }
        }
      });
    }

    function closeCart(options) {
      if (!drawerOpen && (!options || !options.force)) {
        return;
      }
      var settings = options || {};
      window.clearTimeout(drawerCloseTimer);
      drawerOpen = false;
      document.body.classList.remove("cart-open");
      document.body.style.overflow = savedBodyOverflow;
      if (cartLayer) {
        cartLayer.setAttribute("aria-hidden", "true");
      }
      if (cartDrawer) {
        cartDrawer.classList.remove("is-open", "open");
        cartDrawer.setAttribute("aria-hidden", "true");
      }
      if (cartBackdrop) {
        cartBackdrop.classList.remove("is-open", "open");
        cartBackdrop.setAttribute("aria-hidden", "true");
      }
      if (cartToggle) {
        cartToggle.setAttribute("aria-expanded", "false");
      }
      setBackgroundInert(false);

      if (cartDrawer || cartBackdrop) {
        drawerCloseTimer = window.setTimeout(
          function () {
            if (drawerOpen) {
              return;
            }
            if (cartDrawer) {
              cartDrawer.hidden = true;
            }
            if (cartBackdrop) {
              cartBackdrop.hidden = true;
            }
          },
          settings.immediate || reducedMotionQuery.matches ? 0 : 320
        );
      }

      if (!settings.skipFocus) {
        var focusTarget =
          previouslyFocusedElement && document.contains(previouslyFocusedElement)
            ? previouslyFocusedElement
            : cartToggle;
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus();
        }
      }
    }

    function findCartControl(id, action) {
      if (!cartItemsElement) {
        return null;
      }
      return Array.from(
        cartItemsElement.querySelectorAll("[data-cart-action]")
      ).find(function (control) {
        return (
          control.dataset.productId === id &&
          control.dataset.cartAction === action
        );
      }) || null;
    }

    function renderCart() {
      var quantity = calculateCartQuantity(cart);
      var subtotal = calculateCartSubtotal(cart);

      if (cartCount) {
        cartCount.textContent = String(quantity);
        cartCount.setAttribute("aria-label", quantity + (quantity === 1 ? " item" : " items") + " in cart");
      }
      if (cartToggle) {
        cartToggle.setAttribute(
          "aria-label",
          "Shopping cart, " + quantity + (quantity === 1 ? " item" : " items")
        );
        cartToggle.setAttribute("aria-haspopup", "dialog");
        cartToggle.setAttribute("aria-expanded", String(drawerOpen));
      }
      if (cartSubtotal) {
        cartSubtotal.textContent = formatMoney(subtotal);
      }
      if (cartEmpty) {
        cartEmpty.hidden = quantity !== 0;
      }
      if (checkoutButton) {
        checkoutButton.disabled = quantity === 0;
        checkoutButton.setAttribute("aria-disabled", String(quantity === 0));
      }

      if (!cartItemsElement) {
        return;
      }
      cartItemsElement.replaceChildren();
      cartItemsElement.hidden = quantity === 0;

      var fragment = document.createDocumentFragment();
      cart.forEach(function (item) {
        var row = document.createElement(
          cartItemsElement.tagName === "UL" || cartItemsElement.tagName === "OL"
            ? "li"
            : "article"
        );
        row.className = "cart-item";
        row.dataset.productId = item.id;

        if (item.image) {
          var image = document.createElement("img");
          image.className = "cart-item-image";
          image.src = item.image;
          image.alt = "";
          image.loading = "lazy";
          row.appendChild(image);
        } else {
          var imagePlaceholder = document.createElement("span");
          imagePlaceholder.className =
            "cart-item-image cart-item-image-placeholder";
          imagePlaceholder.setAttribute("aria-hidden", "true");
          imagePlaceholder.textContent = "✦";
          imagePlaceholder.style.display = "grid";
          imagePlaceholder.style.placeItems = "center";
          imagePlaceholder.style.color = "var(--orange, currentColor)";
          imagePlaceholder.style.fontSize = "1.5rem";
          row.appendChild(imagePlaceholder);
        }

        var details = document.createElement("div");
        details.className = "cart-item-details";

        var heading = document.createElement("h3");
        heading.className = "cart-item-name";
        heading.textContent = item.name;
        details.appendChild(heading);

        var price = document.createElement("p");
        price.className = "cart-item-price";
        price.textContent =
          formatMoney(item.priceCents) + " each · " +
          formatMoney(item.priceCents * item.quantity);
        details.appendChild(price);

        var controls = document.createElement("div");
        controls.className = "cart-item-actions cart-item-controls";
        controls.setAttribute("role", "group");
        controls.setAttribute("aria-label", "Quantity for " + item.name);
        var quantityControl = document.createElement("div");
        quantityControl.className = "quantity-control cart-quantity";

        function quantityButton(action, symbol, label) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "quantity-button quantity-" + action;
          button.dataset.cartAction = action;
          button.dataset.productId = item.id;
          button.setAttribute("aria-label", label);
          button.textContent = symbol;
          return button;
        }

        quantityControl.appendChild(
          quantityButton("decrease", "−", "Decrease " + item.name + " quantity")
        );

        var quantityOutput = document.createElement("output");
        quantityOutput.className = "cart-item-quantity quantity-value";
        quantityOutput.value = String(item.quantity);
        quantityOutput.textContent = String(item.quantity);
        quantityOutput.setAttribute(
          "aria-label",
          item.quantity + " " + item.name + (item.quantity === 1 ? "" : "s")
        );
        quantityControl.appendChild(quantityOutput);

        var increase = quantityButton(
          "increase",
          "+",
          "Increase " + item.name + " quantity"
        );
        if (item.quantity >= MAX_QUANTITY) {
          increase.disabled = true;
          increase.setAttribute("aria-disabled", "true");
        }
        quantityControl.appendChild(increase);
        controls.appendChild(quantityControl);

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cart-item-remove";
        remove.dataset.cartAction = "remove";
        remove.dataset.productId = item.id;
        remove.setAttribute("aria-label", "Remove " + item.name + " from cart");
        remove.textContent = "Remove";
        controls.appendChild(remove);

        details.appendChild(controls);
        row.appendChild(details);
        fragment.appendChild(row);
      });
      cartItemsElement.appendChild(fragment);
    }

    function commitCartChange(options) {
      var settings = options || {};
      cart = cart.filter(function (item) {
        return item.quantity > 0;
      });
      persistCart();
      renderCart();

      if (settings.focusId && settings.focusAction) {
        nextFrame(function () {
          var target = findCartControl(settings.focusId, settings.focusAction);
          if (target && target.disabled) {
            target = null;
          }
          if (!target) {
            var nextItem = cart[settings.focusIndex];
            if (nextItem) {
              target = findCartControl(nextItem.id, "decrease") ||
                findCartControl(nextItem.id, "remove");
            }
          }
          if (!target) {
            target = cartClose || checkoutButton || cartToggle;
          }
          if (target && typeof target.focus === "function") {
            target.focus();
          }
        });
      }
    }

    function addProductToCart(product) {
      if (!product) {
        showToast("That cookie could not be added. Please try another item.", "error");
        return false;
      }

      var existing = cart.find(function (item) {
        return item.id === product.id;
      });
      if (existing) {
        if (existing.quantity >= MAX_QUANTITY) {
          showToast("You already have the maximum quantity of this cookie.", "warning");
          return false;
        }
        existing.quantity += 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          image: product.image,
          quantity: 1,
        });
      }
      commitCartChange();
      showToast(product.name + " added to your cart.");
      return true;
    }

    var buttonFeedbackTimers = new WeakMap();
    document.addEventListener("click", function (event) {
      var button = closestElement(event.target, ".add-to-cart");
      if (!button || button.disabled) {
        return;
      }
      var product = productFromButton(button);
      if (!product) {
        showToast("This item is temporarily unavailable. Please try another cookie.", "error");
        return;
      }
      catalog.set(product.id, product);
      var added = addProductToCart(product);
      if (!added) {
        return;
      }

      var label =
        button.querySelector("[data-button-label], .button-label") ||
        Array.from(button.childNodes).find(function (node) {
          return node.nodeType === 3 && node.textContent.trim();
        }) ||
        button;
      if (!buttonFeedbackTimers.has(button)) {
        buttonFeedbackTimers.set(button, {
          timer: 0,
          original: label.textContent,
          label: label,
        });
      }
      var feedback = buttonFeedbackTimers.get(button);
      window.clearTimeout(feedback.timer);
      feedback.label.textContent = "Added ✓";
      button.classList.add("is-added", "added");
      feedback.timer = window.setTimeout(function () {
        feedback.label.textContent = feedback.original;
        button.classList.remove("is-added", "added");
      }, reducedMotionQuery.matches ? 850 : 1100);
    });

    if (cartItemsElement) {
      cartItemsElement.addEventListener("click", function (event) {
        var control = closestElement(event.target, "[data-cart-action]");
        if (!control || control.disabled) {
          return;
        }
        var id = control.dataset.productId;
        var index = cart.findIndex(function (item) {
          return item.id === id;
        });
        if (index < 0) {
          showToast("That cart item is no longer available.", "warning");
          renderCart();
          return;
        }

        var item = cart[index];
        var action = control.dataset.cartAction;
        if (action === "increase") {
          if (item.quantity >= MAX_QUANTITY) {
            showToast("Maximum quantity reached for " + item.name + ".", "warning");
            return;
          }
          item.quantity += 1;
        } else if (action === "decrease") {
          item.quantity -= 1;
          if (item.quantity <= 0) {
            cart.splice(index, 1);
          }
        } else if (action === "remove") {
          cart.splice(index, 1);
        } else {
          return;
        }

        commitCartChange({
          focusId: id,
          focusAction: action,
          focusIndex: Math.min(index, Math.max(cart.length - 1, 0)),
        });
      });
    }

    if (cartToggle) {
      cartToggle.addEventListener("click", function () {
        if (drawerOpen) {
          closeCart();
        } else {
          openCart();
        }
      });
    }
    if (cartClose) {
      cartClose.addEventListener("click", function () {
        closeCart();
      });
    }
    if (cartBackdrop) {
      cartBackdrop.addEventListener("click", function () {
        closeCart();
      });
    }

    document.addEventListener("keydown", function (event) {
      var checkoutIsOpen =
        checkoutDialog &&
        (checkoutDialog.open || checkoutDialog.hasAttribute("open"));
      if (!drawerOpen || checkoutIsOpen) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      var focusable = focusableElements(cartDrawer);
      if (!focusable.length) {
        event.preventDefault();
        cartDrawer.focus();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!cartDrawer.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    });

    function initializeCheckout() {
      if (!checkoutDialog || !checkoutForm) {
        return;
      }

      var checkoutReturnFocus = null;
      var checkoutSubmitting = false;
      var fallbackDialogOpen = false;

      function dialogIsOpen() {
        return (
          fallbackDialogOpen ||
          checkoutDialog.open ||
          checkoutDialog.hasAttribute("open")
        );
      }

      function renderCheckoutSummary(items) {
        var totalCents = calculateCartSubtotal(items);
        if (checkoutOrderSummary) {
          checkoutOrderSummary.replaceChildren();
          if (!items.length) {
            var empty = document.createElement(
              checkoutOrderSummary.tagName === "UL" ||
                checkoutOrderSummary.tagName === "OL"
                ? "li"
                : "p"
            );
            empty.className = "checkout-empty-message";
            empty.textContent = "Your cart is empty.";
            checkoutOrderSummary.appendChild(empty);
          } else {
            var list =
              checkoutOrderSummary.tagName === "UL" ||
              checkoutOrderSummary.tagName === "OL"
                ? checkoutOrderSummary
                : document.createElement("ul");
            if (list !== checkoutOrderSummary) {
              list.className = "checkout-summary-list";
            }
            items.forEach(function (item) {
              var row = document.createElement("li");
              row.className = "checkout-summary-item";

              var description = document.createElement("span");
              description.textContent =
                item.quantity + " × " + item.name;
              var lineTotal = document.createElement("strong");
              lineTotal.textContent = formatMoney(
                item.priceCents * item.quantity
              );
              row.appendChild(description);
              row.appendChild(lineTotal);
              list.appendChild(row);
            });
            if (list !== checkoutOrderSummary) {
              checkoutOrderSummary.appendChild(list);
            }
          }
        }
        if (checkoutTotal) {
          checkoutTotal.textContent = formatMoney(totalCents);
        }
      }

      function setConfirmationVisible(visible) {
        if (checkoutConfirmation) {
          checkoutConfirmation.hidden = !visible;
        }
        if (
          checkoutForm &&
          (!checkoutConfirmation || !checkoutForm.contains(checkoutConfirmation))
        ) {
          checkoutForm.hidden = visible;
        }
      }

      function restoreCheckoutFocus() {
        var target =
          checkoutReturnFocus && document.contains(checkoutReturnFocus)
            ? checkoutReturnFocus
            : cartToggle;
        if (target && typeof target.focus === "function") {
          target.focus();
        }
      }

      function closeCheckout() {
        if (!dialogIsOpen()) {
          return;
        }
        if (typeof checkoutDialog.close === "function") {
          try {
            checkoutDialog.close();
          } catch (error) {
            checkoutDialog.removeAttribute("open");
          }
        } else {
          checkoutDialog.removeAttribute("open");
        }
        fallbackDialogOpen = false;
        checkoutDialog.classList.remove("is-open", "open");
        document.body.classList.remove("dialog-open");
        checkoutSubmitting = false;
        restoreCheckoutFocus();
      }

      function openCheckout() {
        if (dialogIsOpen()) {
          return;
        }
        if (!cart.length) {
          renderCart();
          showToast("Add a cookie before starting checkout.", "warning");
          return;
        }

        checkoutReturnFocus = cartToggle;
        checkoutSubmitting = false;
        checkoutForm.reset();
        setConfirmationVisible(false);
        renderCheckoutSummary(cart);
        closeCart({ skipFocus: true, immediate: true });
        checkoutDialog.hidden = false;
        checkoutDialog.classList.add("is-open", "open");
        document.body.classList.add("dialog-open");

        var opened = false;
        if (typeof checkoutDialog.showModal === "function") {
          try {
            checkoutDialog.showModal();
            opened = true;
          } catch (error) {
            opened = false;
          }
        }
        if (!opened) {
          checkoutDialog.setAttribute("open", "");
          checkoutDialog.setAttribute("role", "dialog");
          checkoutDialog.setAttribute("aria-modal", "true");
          fallbackDialogOpen = true;
        }

        nextFrame(function () {
          var firstField = checkoutForm.querySelector(
            "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])"
          );
          if (firstField) {
            firstField.focus();
          } else {
            checkoutForm.focus();
          }
        });
      }

      if (checkoutButton) {
        checkoutButton.addEventListener("click", openCheckout);
      }
      if (checkoutClose) {
        checkoutClose.addEventListener("click", closeCheckout);
      }
      if (checkoutDone) {
        checkoutDone.addEventListener("click", function () {
          closeCheckout();
          var cookiesSection = byId("cookies");
          if (!cookiesSection) {
            return;
          }
          nextFrame(function () {
            scrollToElement(
              cookiesSection,
              reducedMotionQuery.matches ? "auto" : "smooth"
            );
            if (!cookiesSection.hasAttribute("tabindex")) {
              cookiesSection.setAttribute("tabindex", "-1");
            }
            try {
              cookiesSection.focus({ preventScroll: true });
            } catch (error) {
              cookiesSection.focus();
            }
            navigation.activate("cookies");
          });
        });
      }

      checkoutDialog.addEventListener("cancel", function () {
        fallbackDialogOpen = false;
        checkoutDialog.classList.remove("is-open", "open");
        document.body.classList.remove("dialog-open");
        checkoutSubmitting = false;
        window.setTimeout(restoreCheckoutFocus, 0);
      });
      checkoutDialog.addEventListener("close", function () {
        fallbackDialogOpen = false;
        checkoutDialog.classList.remove("is-open", "open");
        document.body.classList.remove("dialog-open");
        checkoutSubmitting = false;
        restoreCheckoutFocus();
      });
      checkoutDialog.addEventListener("click", function (event) {
        if (event.target !== checkoutDialog || !dialogIsOpen()) {
          return;
        }
        var rect = checkoutDialog.getBoundingClientRect();
        var outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (outside) {
          closeCheckout();
        }
      });

      checkoutForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (checkoutSubmitting) {
          return;
        }
        if (!cart.length) {
          renderCheckoutSummary([]);
          showToast("Your cart is empty. Add a cookie before checking out.", "warning");
          return;
        }
        if (!checkoutForm.checkValidity()) {
          checkoutForm.reportValidity();
          return;
        }

        checkoutSubmitting = true;
        var orderNumber = "CC-" + Date.now().toString(36).slice(-6).toUpperCase();
        var completedItems = cart.map(function (item) {
          return {
            id: item.id,
            name: item.name,
            priceCents: item.priceCents,
            image: item.image,
            quantity: item.quantity,
          };
        });
        renderCheckoutSummary(completedItems);

        cart = [];
        persistCart();
        renderCart();
        checkoutForm.reset();

        if (checkoutConfirmation) {
          var message = checkoutConfirmation.querySelector("[data-order-message]");
          if (!message) {
            message = document.createElement("p");
            message.className = "order-confirmation-message";
            message.setAttribute("data-order-message", "");
            checkoutConfirmation.appendChild(message);
          }
          message.textContent =
            "Demo order " + orderNumber + " is confirmed. No payment was collected.";
          checkoutConfirmation.setAttribute("tabindex", "-1");
        }
        setConfirmationVisible(true);

        if (checkoutConfirmation) {
          nextFrame(function () {
            checkoutConfirmation.focus();
          });
        } else if (checkoutClose) {
          checkoutClose.focus();
        }
      });
    }

    initializeCheckout();

    if (newsletterForm && newsletterEmail && newsletterStatus) {
      newsletterStatus.setAttribute("role", "status");
      newsletterStatus.setAttribute("aria-live", "polite");

      function setNewsletterStatus(message, valid) {
        newsletterStatus.textContent = message;
        newsletterStatus.hidden = !message;
        newsletterStatus.classList.toggle("is-success", valid);
        newsletterStatus.classList.toggle("success", valid);
        newsletterStatus.classList.toggle("is-error", !valid && Boolean(message));
        newsletterStatus.classList.toggle("error", !valid && Boolean(message));
        newsletterEmail.setAttribute("aria-invalid", String(!valid && Boolean(message)));
      }

      newsletterForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var email = newsletterEmail.value.trim();
        newsletterEmail.value = email;
        var simpleEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        var valid =
          Boolean(email) &&
          newsletterEmail.checkValidity() &&
          simpleEmailPattern.test(email);

        if (!valid) {
          setNewsletterStatus("Please enter a valid email address.", false);
          newsletterEmail.focus();
          if (typeof newsletterEmail.reportValidity === "function") {
            newsletterEmail.reportValidity();
          }
          return;
        }

        setNewsletterStatus(
          "You're on the list! This demo signup does not send or store your email.",
          true
        );
        newsletterForm.reset();
        newsletterEmail.setAttribute("aria-invalid", "false");
      });

      newsletterEmail.addEventListener("input", function () {
        if (newsletterEmail.getAttribute("aria-invalid") === "true") {
          setNewsletterStatus("", true);
        }
      });
    }

    function syncCartFromStorage(event) {
      if (!storageAvailable) {
        return;
      }
      if (event.storageArea && event.storageArea !== storage) {
        return;
      }
      if (event.key === null) {
        initialStorageValue = null;
        cart = [];
        renderCart();
        showToast("Your saved cart was cleared in another tab.", "warning");
        return;
      }
      if (event.key !== STORAGE_KEY || event.newValue === initialStorageValue) {
        return;
      }
      initialStorageValue = event.newValue;
      if (event.newValue === null) {
        cart = [];
        renderCart();
        showToast("Your cart was updated in another tab.", "warning");
        return;
      }

      try {
        var validation = validateStoredCart(JSON.parse(event.newValue), catalog);
        if (!validation.fatal) {
          cart = validation.items;
          renderCart();
          if (validation.rejected) {
            exposeStorageWarning("An updated saved cart contained invalid items that were removed.");
          }
        } else {
          exposeStorageWarning("A saved cart update was invalid and was ignored.");
        }
      } catch (error) {
        exposeStorageWarning("A saved cart update was unreadable and was ignored.");
      }
    }

    window.addEventListener("storage", syncCartFromStorage);
    if (cartDrawer) {
      cartDrawer.setAttribute("role", "dialog");
      cartDrawer.setAttribute("aria-modal", "true");
      cartDrawer.setAttribute("aria-hidden", "true");
      cartDrawer.setAttribute("tabindex", "-1");
      if (cartDrawer.hasAttribute("hidden")) {
        cartDrawer.hidden = true;
      }
    }
    if (cartBackdrop) {
      cartBackdrop.setAttribute("aria-hidden", "true");
    }
    if (cartLayer) {
      cartLayer.setAttribute("aria-hidden", "true");
    }

    if (
      initialStorageValue !== null &&
      storageAvailable &&
      storageNeedsRewrite
    ) {
      persistCart();
    }

    renderCart();
    closeCart({ immediate: true, skipFocus: true, force: true });
  });
})();
