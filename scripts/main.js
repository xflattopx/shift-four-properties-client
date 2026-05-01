document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('seller-form');
    const formSection = document.getElementById('seller-form-section');
    const formMessage = document.getElementById('form-message');
    // Submit-state toggling targets only the real form submit buttons.
    // (.mobile-submit-btn is now an anchor scroll-back link, not a form submit.)
    const submitButtons = Array.from(
        document.querySelectorAll('#seller-form button[type="submit"]')
    );
    const defaultSubmitText = 'Get My Cash Offer →';
    const successModal = document.getElementById('success-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    function setSubmitButtonsState(isSubmitting) {
        submitButtons.forEach(function(button) {
            button.disabled = isSubmitting;
            button.textContent = isSubmitting ? 'Sending…' : defaultSubmitText;
        });
    }

    // ---- UTM / Attribution capture -------------------------------------------------
    // Read UTM params from the URL on first landing, persist to sessionStorage,
    // and hydrate the hidden form fields so every lead carries its source context
    // even if the visitor browses, opens FAQs, or returns through an anchor link.
    const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const UTM_STORAGE_KEY = 'sfp_attribution_v1';

    function captureAttribution() {
        let stored = {};
        try {
            stored = JSON.parse(sessionStorage.getItem(UTM_STORAGE_KEY) || '{}');
        } catch (err) { stored = {}; }

        const params = new URLSearchParams(window.location.search);
        let updated = false;
        UTM_KEYS.forEach(function(key) {
            const fromUrl = params.get(key);
            if (fromUrl && fromUrl.trim()) {
                stored[key] = fromUrl.trim().slice(0, 120); // cap length defensively
                updated = true;
            }
        });

        // First-touch landing page + referrer — only set once per session.
        if (!stored.landing_page) {
            stored.landing_page = window.location.href.slice(0, 500);
            updated = true;
        }
        if (!stored.referrer && document.referrer) {
            stored.referrer = document.referrer.slice(0, 500);
            updated = true;
        }

        if (updated) {
            try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(stored)); } catch (err) { /* no-op */ }
        }

        // Hydrate hidden form fields
        UTM_KEYS.forEach(function(key) {
            const input = document.getElementById(key);
            if (input && stored[key]) input.value = stored[key];
        });
        const landingInput  = document.getElementById('landing_page');
        const referrerInput = document.getElementById('referrer');
        if (landingInput && stored.landing_page) landingInput.value = stored.landing_page;
        if (referrerInput && stored.referrer)    referrerInput.value = stored.referrer;

        return stored;
    }

    const attribution = captureAttribution();

    const isFormHash = window.location.hash === '#seller-form' || window.location.hash === '#seller-form-section';

    // Only scroll to form when explicitly linked — never auto-scroll on clean page load.
    // This ensures visitors see the hero headline and humanization content first.
    if (isFormHash && formSection) {
        requestAnimationFrame(function() {
            formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // Auto-format phone as (555) 555-5555 + real-time green-border validation.
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function() {
        const digits = this.value.replace(/\D/g, '').slice(0, 10);
        let formatted = '';
        if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
        if (digits.length >= 4) formatted += ') ' + digits.slice(3, 6);
        if (digits.length >= 7) formatted += '-' + digits.slice(6, 10);
        this.value = formatted;

        // Positive reinforcement: green border + ✓ when 10 digits entered.
        this.classList.toggle('is-valid', digits.length === 10);
        this.classList.remove('has-error');
    });

    // Address: light validation feedback once the seller has typed something
    // resembling an address (≥ 8 chars and at least one digit suggests a number).
    const addressInput = document.getElementById('address');
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            const v = this.value.trim();
            const looksLikeAddress = v.length >= 8 && /\d/.test(v);
            this.classList.toggle('is-valid', looksLikeAddress);
            this.classList.remove('has-error');
        });
    }

    // Name: any 2+ char input is valid (we only ask for first name)
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            this.classList.toggle('is-valid', this.value.trim().length >= 2);
            this.classList.remove('has-error');
        });
    }

    // Modal close handlers
    modalCloseBtn.addEventListener('click', function() {
        successModal.hidden = true;
    });

    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) successModal.hidden = true;
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !successModal.hidden) {
            successModal.hidden = true;
        }
    });

    // ---- MOBILE STICKY SCROLL-BACK CTA ---------------------------------------------
    // Default state: the inline form submit button lives inside the form
    // and is the seller's primary call to action. The .mobile-submit-wrap
    // bar is hidden off-screen.
    //
    // When the user scrolls PAST the form (form's bottom edge above the
    // viewport top), the bar slides up and offers a one-tap scroll back
    // to the form. Tapping it is an anchor scroll, not a form submit —
    // the form fields aren't filled in yet, so submitting would just fail
    // validation.
    //
    // When the form re-enters the viewport, the bar slides back down.
    const stickyWrap = document.getElementById('mobile-sticky-cta');
    if (stickyWrap && formSection && 'IntersectionObserver' in window) {
        const showSticky = function(show) {
            stickyWrap.classList.toggle('is-visible', show);
            stickyWrap.setAttribute('aria-hidden', show ? 'false' : 'true');
        };

        const obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                // Only show when the form is OUT of viewport AND the user
                // has scrolled below it (form bottom is above viewport top).
                // Scrolling above the form (e.g., on initial load) keeps it hidden.
                const pastForm = entry.boundingClientRect.bottom < 0;
                showSticky(!entry.isIntersecting && pastForm);
            });
        }, {
            // Generous root margin avoids flicker at the boundary.
            rootMargin: '0px 0px -10% 0px',
            threshold: 0
        });

        obs.observe(formSection);
    }

    // ---- BUTTON-CHIP SELECTION -----------------------------------------------------
    // Replaces native <select> dropdowns with thumb-friendly tap targets. Each chip
    // group writes its selected value to a hidden input (#condition or #timeline)
    // so the submit handler and API contract remain identical.
    form.querySelectorAll('.chip-group').forEach(function(group) {
        const targetId = group.getAttribute('data-target');
        const hiddenInput = document.getElementById(targetId);
        const chips = Array.from(group.querySelectorAll('.chip'));

        chips.forEach(function(chip) {
            chip.addEventListener('click', function() {
                chips.forEach(function(c) { c.classList.remove('is-selected'); });
                chip.classList.add('is-selected');
                if (hiddenInput) hiddenInput.value = chip.getAttribute('data-value') || '';

                // Clear any prior validation error on this group + the form message
                group.classList.remove('has-error');
                if (formMessage) {
                    formMessage.textContent = '';
                    formMessage.className = 'form-message';
                }

                // Auto-advance: scroll the next field into view so the seller
                // doesn't have to hunt for what's next. We don't auto-focus
                // text inputs because that triggers the keyboard on mobile,
                // which can disorient users mid-form.
                let nextEl = null;
                if (targetId === 'condition') {
                    nextEl = document.querySelector('.chip-group[data-target="timeline"]');
                } else if (targetId === 'timeline') {
                    nextEl = document.getElementById('name');
                }
                if (nextEl) {
                    // Small delay lets the chip "selected" animation render first.
                    setTimeout(function() {
                        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 120);
                }
            });
        });
    });

    // Resolve API base URL
    const configuredApiBase = typeof window.SFP_API_BASE_URL === 'string'
        ? window.SFP_API_BASE_URL.trim()
        : '';
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const localApiBase = isLocalHost && window.location.port !== '3000'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : '';
    const apiBaseUrl = (configuredApiBase || localApiBase).replace(/\/$/, '');
    const leadsEndpoint = `${apiBaseUrl}/api/leads`;

    // Safe wrapper for Facebook Pixel — never breaks the page if fbq is blocked/unloaded.
    function trackFbEvent(eventName, params) {
        try {
            if (typeof window.fbq === 'function') {
                window.fbq('track', eventName, params || {});
            }
        } catch (err) {
            // Silently ignore — tracking must never interrupt the user flow.
        }
    }

    // Fire a "lead intent" signal as soon as the user clicks the CTA button,
    // BEFORE validation. This gives Facebook a higher-volume signal to learn
    // from even when the submit ultimately fails. Dedup via eventID so it
    // doesn't double-count with the Lead event on successful submit.
    submitButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            try {
                if (typeof window.fbq === 'function') {
                    window.fbq('trackCustom', 'PropertyValueRequested', {
                        content_name: 'Send Me My Cash Offer',
                        content_category: 'Seller Lead Form'
                    });
                }
            } catch (err) { /* no-op */ }
        });
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        // ---- HONEYPOT GATE -----------------------------------------------------
        // Bots scrape and fill every input. Humans never see this field
        // (offscreen via .hp-field). If it has any value, the submission
        // is from a bot — silently fake-success it and abort. Bot moves on
        // to the next site without knowing it was caught; we keep the lead
        // inbox clean and don't fire a Pixel Lead event.
        const honeypot = document.getElementById('hp_website');
        if (honeypot && honeypot.value) {
            successModal.hidden = false;
            modalCloseBtn.focus();
            form.reset();
            return;
        }

        const name      = document.getElementById('name').value.trim();
        const phone     = document.getElementById('phone').value.trim();
        const address   = document.getElementById('address').value.trim();
        const condition = document.getElementById('condition').value;
        const timeline  = document.getElementById('timeline').value;

        // Pull latest attribution snapshot at submit time (survives SPA-like nav).
        const attr = captureAttribution();

        formMessage.textContent = '';
        formMessage.className = 'form-message';
        // Clear any prior field-level error states before re-validating.
        form.querySelectorAll('.has-error').forEach(function(el) {
            el.classList.remove('has-error');
        });

        if (!validateForm(name, phone, address, condition, timeline)) {
            return;
        }

        setSubmitButtonsState(true);

        try {
            const response = await fetch(leadsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, phone, address, condition, timeline,
                    utm_source:   attr.utm_source   || '',
                    utm_medium:   attr.utm_medium   || '',
                    utm_campaign: attr.utm_campaign || '',
                    utm_content:  attr.utm_content  || '',
                    utm_term:     attr.utm_term     || '',
                    landing_page: attr.landing_page || '',
                    referrer:     attr.referrer     || ''
                })
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            // ✅ Primary Facebook conversion event — fires ONLY after the lead
            // successfully reaches the API. This is what FB Ads optimizes against.
            trackFbEvent('Lead', {
                content_name: 'Seller Cash Offer Request',
                content_category: 'Motivated Seller Lead',
                value: 25.00,          // Estimated lead value for optimization weighting
                currency: 'USD',
                lead_type: 'seller',
                property_condition: condition,
                timeline: timeline,
                utm_campaign: attr.utm_campaign || '',
                utm_content:  attr.utm_content  || '',
                utm_source:   attr.utm_source   || ''
            });

            // Also fire CompleteRegistration for ad sets that were published against
            // that event (FB locks the conversion event on published ad sets, so we
            // fire both so legacy ad sets keep getting credit alongside new Lead-
            // optimized ones). Safe to remove once all ad sets are migrated to Lead.
            trackFbEvent('CompleteRegistration', {
                content_name: 'Seller Cash Offer Request',
                status: 'completed',
                value: 25.00,
                currency: 'USD',
                property_condition: condition,
                timeline: timeline
            });

            // Reset form fields AND chip selections for a clean slate.
            form.reset();
            form.querySelectorAll('.chip.is-selected').forEach(function(c) {
                c.classList.remove('is-selected');
            });
            document.getElementById('condition').value = '';
            document.getElementById('timeline').value  = '';

            successModal.hidden = false;
            modalCloseBtn.focus();
        } catch (error) {
            formMessage.textContent = 'Could not send your request right now. Please call or text (252) 227-0175 directly.';
            formMessage.classList.add('error');
        } finally {
            setSubmitButtonsState(false);
        }
    });

    // Mark the offending field so the seller can see at a glance what to fix,
    // then scroll it into view (centered) and surface the error message.
    function flagField(el, message) {
        if (el) {
            el.classList.add('has-error');
            // Brief delay so the smooth scroll feels intentional, not jarring.
            setTimeout(function() {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
        }
        formMessage.textContent = message;
        formMessage.classList.add('error');
    }

    function validateForm(name, phone, address, condition, timeline) {
        if (!address) {
            flagField(document.getElementById('address'), 'I’ll need the property address to pull comps.');
            return false;
        }
        if (!condition) {
            flagField(document.querySelector('.chip-group[data-target="condition"]'), 'Pick a condition so I can sharpen the offer.');
            return false;
        }
        if (!timeline) {
            flagField(document.querySelector('.chip-group[data-target="timeline"]'), 'Let me know your timeline so I can match the offer to it.');
            return false;
        }
        if (!name) {
            flagField(document.getElementById('name'), 'A first name works — what should I call you?');
            return false;
        }
        if (!phone) {
            flagField(document.getElementById('phone'), 'I’ll need a number to text the offer to.');
            return false;
        }

        const phonePattern = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        if (!phonePattern.test(phone)) {
            flagField(document.getElementById('phone'), 'Please enter a valid 10-digit phone number so I can text you the offer.');
            return false;
        }

        return true;
    }
});
