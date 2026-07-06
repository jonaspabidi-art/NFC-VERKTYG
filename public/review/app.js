(function () {
  const LANG_KEY = "rr_lang";

  const I18N = {
    sv: {
      pageTitle: "Lämna en recension",
      loading: "Laddar...",
      notFoundTitle: "Restaurangen hittades inte",
      notFoundText: "Kontrollera länken eller fråga personalen om hjälp.",
      reviewInstruction: "Hur var din upplevelse hos oss idag? Tryck på en stjärna.",
      honeypotLabel: "Lämna detta fält tomt",
      resultHighTitle: "Tack för ditt fina betyg!",
      resultHighText:
        "Dela gärna din upplevelse på Google - visa sedan upp den här skärmen i kassan så får du din rabatt.",
      googleLinkText: "Dela recension på Google",
      discountInstruction: "Visa upp för personalen i kassan",
      discountValidPrefix: "Giltig till ",
      discountSuffix: "% rabatt",
      phoneLabel: "Vill du låsa upp extra rabatt? (valfritt)",
      phonePlaceholder: "Ditt telefonnummer",
      phoneInstruction:
        "Lämna ditt nummer och dela recensionen på Google, så höjs rabatten på koden ovan. Hinner du inte just nu skickar vi en påminnelse om 15 minuter.",
      savePhoneButton: "Lås upp extra rabatt",
      phoneSuccessScheduled: "Tack! Vi påminner dig om du inte hunnit dela än.",
      phoneBonusUnlocked: "Grattis, din rabatt är uppdaterad!",
      commentLabelHigh: "Vill du lägga till en kommentar? (valfritt)",
      commentPlaceholderHigh: "Berätta gärna mer...",
      saveCommentButton: "Spara kommentar",
      commentSuccess: "Tack, kommentaren sparades!",
      resultThanksTitle: "Tack för din feedback!",
      thanksDefaultMessage: "Den går direkt till restaurangen så vi kan bli bättre.",
      commentLabelThanks: "Berätta gärna vad som kan bli bättre (valfritt)",
      commentPlaceholderThanks: "Din feedback går direkt till restaurangen...",
      contactLabel: "Vill du att vi hör av oss? (valfritt)",
      contactEmailPlaceholder: "Din e-post",
      contactConsent:
        "Genom att lämna dina uppgifter godkänner du att restaurangen kontaktar dig angående din upplevelse.",
      saveContactButton: "Skicka",
      contactSuccess: "Tack, vi hör av oss!",
      genericServerError: "Kunde inte nå servern, försök igen.",
      genericError: "Något gick fel, försök igen.",
    },
    en: {
      pageTitle: "Leave a review",
      loading: "Loading...",
      notFoundTitle: "Restaurant not found",
      notFoundText: "Check the link or ask staff for help.",
      reviewInstruction: "How was your experience with us today? Tap a star.",
      honeypotLabel: "Leave this field empty",
      resultHighTitle: "Thanks for your great rating!",
      resultHighText: "Please share your experience on Google - then show this screen at checkout to get your discount.",
      googleLinkText: "Share review on Google",
      discountInstruction: "Show this to staff at checkout",
      discountValidPrefix: "Valid until ",
      discountSuffix: "% discount",
      phoneLabel: "Want to unlock extra discount? (optional)",
      phonePlaceholder: "Your phone number",
      phoneInstruction:
        "Leave your number and share the review on Google to boost the discount on the code above. If you don't have time right now, we'll send a reminder in 15 minutes.",
      savePhoneButton: "Unlock extra discount",
      phoneSuccessScheduled: "Thanks! We'll remind you if you haven't shared yet.",
      phoneBonusUnlocked: "Congrats, your discount has been updated!",
      commentLabelHigh: "Want to add a comment? (optional)",
      commentPlaceholderHigh: "Tell us more...",
      saveCommentButton: "Save comment",
      commentSuccess: "Thanks, your comment was saved!",
      resultThanksTitle: "Thanks for your feedback!",
      thanksDefaultMessage: "It goes straight to the restaurant so we can improve.",
      commentLabelThanks: "Tell us what could be better (optional)",
      commentPlaceholderThanks: "Your feedback goes straight to the restaurant...",
      contactLabel: "Want us to reach out? (optional)",
      contactEmailPlaceholder: "Your email",
      contactConsent: "By providing your details you agree that the restaurant may contact you about your experience.",
      saveContactButton: "Send",
      contactSuccess: "Thanks, we'll be in touch!",
      genericServerError: "Could not reach the server, please try again.",
      genericError: "Something went wrong, please try again.",
    },
  };

  const ERROR_MESSAGES = {
    sv: {
      restaurant_not_found: "Restaurangen hittades inte.",
      server_error: "Något gick fel, försök igen.",
      invalid_rating: "Ogiltigt betyg eller restaurang.",
      already_reviewed: "Du har redan lämnat en recension nyligen. Tack!",
      review_not_found: "Recensionen hittades inte.",
      comment_empty: "Kommentaren kan inte vara tom.",
      contact_required: "Ange e-post eller telefonnummer.",
      invalid_email: "Ogiltig e-postadress.",
      invalid_phone: "Ogiltigt telefonnummer.",
      thanks_low: "Tack för din feedback! Den går direkt till restaurangen.",
      thanks_no_discount: "Tack för din recension!",
    },
    en: {
      restaurant_not_found: "Restaurant not found.",
      server_error: "Something went wrong, please try again.",
      invalid_rating: "Invalid rating or restaurant.",
      already_reviewed: "You've already left a review recently. Thanks!",
      review_not_found: "Review not found.",
      comment_empty: "The comment cannot be empty.",
      contact_required: "Please enter an email or phone number.",
      invalid_email: "Invalid email address.",
      invalid_phone: "Invalid phone number.",
      thanks_low: "Thank you for your feedback! It goes straight to the restaurant.",
      thanks_no_discount: "Thank you for your review!",
    },
  };

  function detectDefaultLang() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "sv" || saved === "en") return saved;
    return navigator.language && navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
  }

  let currentLang = detectDefaultLang();

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.sv[key] || key;
  }

  function resolveMessage(code, fallbackText) {
    if (code && ERROR_MESSAGES[currentLang] && ERROR_MESSAGES[currentLang][code]) {
      return ERROR_MESSAGES[currentLang][code];
    }
    return fallbackText || t("genericError");
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLang;
    document.title = t("pageTitle");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    applyStaticTranslations();
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  applyStaticTranslations();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("r");

  const loadingEl = document.getElementById("loading");
  const notFoundEl = document.getElementById("not-found");
  const formEl = document.getElementById("review-form");
  const resultHighEl = document.getElementById("result-high");
  const resultThanksEl = document.getElementById("result-thanks");

  function show(el) {
    [loadingEl, notFoundEl, formEl, resultHighEl, resultThanksEl].forEach((e) => e.classList.add("hidden"));
    el.classList.remove("hidden");
  }

  if (!slug) {
    show(notFoundEl);
    return;
  }

  const starsContainer = document.getElementById("stars");
  const stars = document.querySelectorAll("#stars .star");
  const formError = document.getElementById("form-error");
  let currentReviewId = null;

  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

  function applyBranding(restaurant) {
    if (restaurant.logoUrl) {
      const logo = document.getElementById("restaurant-logo");
      logo.addEventListener("error", () => logo.classList.add("hidden"));
      logo.src = restaurant.logoUrl;
      logo.classList.remove("hidden");
    }

    if (restaurant.accentColor && HEX_COLOR_PATTERN.test(restaurant.accentColor)) {
      const root = document.documentElement.style;
      root.setProperty("--gold", restaurant.accentColor);
      const r = parseInt(restaurant.accentColor.slice(1, 3), 16);
      const g = parseInt(restaurant.accentColor.slice(3, 5), 16);
      const b = parseInt(restaurant.accentColor.slice(5, 7), 16);
      root.setProperty("--gold-soft", `rgba(${r}, ${g}, ${b}, 0.15)`);
    }
  }

  fetch(`/api/restaurants/${encodeURIComponent(slug)}`)
    .then((res) => {
      if (!res.ok) throw new Error("not-found");
      return res.json();
    })
    .then((restaurant) => {
      document.getElementById("restaurant-name").textContent = restaurant.name;
      applyBranding(restaurant);
      show(formEl);
    })
    .catch(() => {
      show(notFoundEl);
    });

  stars.forEach((star) => {
    star.addEventListener("click", () => submitRating(Number(star.dataset.value)));
  });

  async function submitRating(rating) {
    stars.forEach((s) => s.classList.toggle("active", Number(s.dataset.value) <= rating));
    starsContainer.classList.add("disabled");
    formError.classList.add("hidden");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          rating,
          website: document.getElementById("website").value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        formError.textContent = resolveMessage(data.code, data.error);
        formError.classList.remove("hidden");
        starsContainer.classList.remove("disabled");
        return;
      }

      currentReviewId = data.reviewId;

      if (data.status === "high_rating") {
        document.getElementById("discount-percent").textContent = `${data.discountPercent}${t("discountSuffix")}`;
        document.getElementById("discount-code").textContent = data.discountCode;
        const validUntil = new Date(data.discountValidUntil);
        document.getElementById("discount-valid").textContent =
          t("discountValidPrefix") + validUntil.toLocaleDateString(currentLang === "sv" ? "sv-SE" : "en-GB");

        const googleLink = document.getElementById("google-link");
        googleLink.href = data.googleReviewUrl;
        googleLink.addEventListener("click", () => {
          fetch(`/api/reviews/${data.reviewId}/google-click`, { method: "POST" })
            .then((r) => r.json())
            .then((clickData) => {
              if (clickData.bonusApplied) {
                showBonusUnlocked(clickData.discountPercent);
              }
            })
            .catch(() => {});
        });

        show(resultHighEl);
      } else {
        document.getElementById("thanks-message").textContent = resolveMessage(
          data.messageCode,
          data.message || t("thanksDefaultMessage")
        );
        show(resultThanksEl);
      }
    } catch (err) {
      formError.textContent = t("genericServerError");
      formError.classList.remove("hidden");
      starsContainer.classList.remove("disabled");
    }
  }

  function showBonusUnlocked(discountPercent) {
    document.getElementById("discount-percent").textContent = `${discountPercent}${t("discountSuffix")}`;
    const phoneMessage = document.getElementById("phone-message");
    phoneMessage.textContent = t("phoneBonusUnlocked");
    phoneMessage.classList.remove("hidden");
  }

  function wireCommentFollowup(textareaId, buttonId, messageId) {
    const textarea = document.getElementById(textareaId);
    const button = document.getElementById(buttonId);
    const message = document.getElementById(messageId);

    button.addEventListener("click", async () => {
      const comment = textarea.value.trim();
      if (!comment || !currentReviewId) return;

      message.classList.add("hidden");
      button.disabled = true;

      try {
        const res = await fetch(`/api/reviews/${currentReviewId}/comment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        });
        const data = await res.json();

        message.textContent = res.ok ? t("commentSuccess") : resolveMessage(data.code, data.error);
        message.classList.remove("hidden");
        if (res.ok) {
          textarea.disabled = true;
          button.disabled = true;
        } else {
          button.disabled = false;
        }
      } catch (err) {
        message.textContent = t("genericServerError");
        message.classList.remove("hidden");
        button.disabled = false;
      }
    });
  }

  wireCommentFollowup("comment-high", "save-comment-high", "comment-message-high");
  wireCommentFollowup("comment-thanks", "save-comment-thanks", "comment-message-thanks");

  document.getElementById("save-contact").addEventListener("click", async () => {
    const emailInput = document.getElementById("contact-email");
    const phoneInput = document.getElementById("contact-phone");
    const button = document.getElementById("save-contact");
    const message = document.getElementById("contact-message");

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!email && !phone) return;

    message.classList.add("hidden");
    button.disabled = true;

    try {
      const res = await fetch(`/api/reviews/${currentReviewId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();

      message.textContent = res.ok ? t("contactSuccess") : resolveMessage(data.code, data.error);
      message.classList.remove("hidden");
      if (res.ok) {
        emailInput.disabled = true;
        phoneInput.disabled = true;
      } else {
        button.disabled = false;
      }
    } catch (err) {
      message.textContent = t("genericServerError");
      message.classList.remove("hidden");
      button.disabled = false;
    }
  });

  document.getElementById("save-phone").addEventListener("click", async () => {
    const phoneInput = document.getElementById("bonus-phone");
    const button = document.getElementById("save-phone");
    const message = document.getElementById("phone-message");

    const phone = phoneInput.value.trim();
    if (!phone) return;

    message.classList.add("hidden");
    button.disabled = true;

    try {
      const res = await fetch(`/api/reviews/${currentReviewId}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        message.textContent = resolveMessage(data.code, data.error);
        message.classList.remove("hidden");
        button.disabled = false;
        return;
      }

      phoneInput.disabled = true;
      if (data.bonusApplied) {
        showBonusUnlocked(data.discountPercent);
      } else {
        message.textContent = t("phoneSuccessScheduled");
        message.classList.remove("hidden");
      }
    } catch (err) {
      message.textContent = t("genericServerError");
      message.classList.remove("hidden");
      button.disabled = false;
    }
  });
})();
