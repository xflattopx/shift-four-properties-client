document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('seller-form');
    const formSection = document.getElementById('seller-form-section');
    const formMessage = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');
    const successModal = document.getElementById('success-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

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

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const name     = document.getElementById('name').value.trim();
        const phone    = document.getElementById('phone').value.trim();
        const address  = document.getElementById('address').value.trim();
        const condition = document.getElementById('condition').value;
        const timeline = document.getElementById('timeline').value;

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
                body: JSON.stringify({ name, phone, address, condition, timeline })
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            form.reset();
            successModal.hidden = false;
            modalCloseBtn.focus();
        } catch (error) {
            formMessage.textContent = 'Could not send your request right now. Please call or text (252) 227-0175 directly.';
            formMessage.classList.add('error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Get My Free Cash Offer →';
        }
    });

    function validateForm(name, phone, address, condition, timeline) {
        if (!name || !phone || !address || !condition || !timeline) {
            formMessage.textContent = 'Please fill out all fields before submitting.';
            formMessage.classList.add('error');
            return false;
        }

        const phonePattern = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        if (!phonePattern.test(phone)) {
            formMessage.textContent = 'Please enter a valid 10-digit phone number so I can reach you.';
            formMessage.classList.add('error');
            return false;
        }

        return true;
    }
});
