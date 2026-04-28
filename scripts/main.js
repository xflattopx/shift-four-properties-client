document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('seller-form');
    const formSection = document.getElementById('seller-form-section');
    const formMessage = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');
    const successModal = document.getElementById('success-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

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

    // Auto-format phone as (555) 555-5555
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function() {
        const digits = this.value.replace(/\D/g, '').slice(0, 10);
        let formatted = '';
        if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
        if (digits.length >= 4) formatted += ') ' + digits.slice(3, 6);
        if (digits.length >= 7) formatted += '-' + digits.slice(6, 10);
        this.value = formatted;
    });

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
                // Clear any prior validation error inline
                if (formMessage) {
                    formMessage.textContent = '';
                    formMessage.className = 'form-message';
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
    submitButton.addEventListener('click', function() {
        try {
            if (typeof window.fbq === 'function') {
                window.fbq('trackCustom', 'PropertyValueRequested', {
                    content_name: 'Send Me My Cash Offer',
                    content_category: 'Seller Lead Form'
                });
            }
        } catch (err) { /* no-op */ }
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const name      = document.getElementById('name').value.trim();
        const phone     = document.getElementById('phone').value.trim();
        const address   = document.getElementById('address').value.trim();
        const condition = document.getElementById('condition').value;
        const timeline  = document.getElementById('timeline').value;

        // Pull latest attribution snapshot at submit time (survives SPA-like nav).
        const attr = captureAttribution();

        formMessage.textContent = '';
        formMessage.className = 'form-message';

        if (!validateForm(name, phone, address, condition, timeline)) {
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Sending…';

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
            submitButton.disabled = false;
            submitButton.textContent = 'Send Me My Cash Offer →';
        }
    });

    function validateForm(name, phone, address, condition, timeline) {
        if (!address) {
            formMessage.textContent = 'I’ll need the property address to pull comps.';
            formMessage.classList.add('error');
            return false;
        }
        if (!condition) {
            formMessage.textContent = 'Pick a condition so I can sharpen the offer.';
            formMessage.classList.add('error');
            return false;
        }
        if (!timeline) {
            formMessage.textContent = 'Let me know your timeline so I can match the offer to it.';
            formMessage.classList.add('error');
            return false;
        }
        if (!name) {
            formMessage.textContent = 'A first name works — what should I call you?';
            formMessage.classList.add('error');
            return false;
        }
        if (!phone) {
            formMessage.textContent = 'I’ll need a number to text the offer to.';
            formMessage.classList.add('error');
            return false;
        }

        const phonePattern = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        if (!phonePattern.test(phone)) {
            formMessage.textContent = 'Please enter a valid 10-digit phone number so I can text you the offer.';
            formMessage.classList.add('error');
            return false;
        }

        return true;
    }
});
