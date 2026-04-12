document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('seller-form');
    const formMessage = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');
    const successModal = document.getElementById('success-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

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

    modalCloseBtn.addEventListener('click', function() {
        successModal.hidden = true;
    });

    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) successModal.hidden = true;
    });
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
        
        const name = document.getElementById('name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const address = document.getElementById('address').value.trim();
        const condition = document.getElementById('condition').value;

        formMessage.textContent = '';
        formMessage.className = 'form-message';

        if (!validateForm(name, phone, address, condition)) {
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        try {
            const response = await fetch(leadsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, phone, address, condition })
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            form.reset();
            successModal.hidden = false;
            modalCloseBtn.focus();
        } catch (error) {
            formMessage.textContent = 'Could not send your request right now. Please call us directly.';
            formMessage.classList.add('error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Get My Cash Offer';
        }
    });

    function validateForm(name, phone, address, condition) {
        if (!name || !phone || !address || !condition) {
            formMessage.textContent = 'Please fill out all fields before submitting.';
            formMessage.classList.add('error');
            return false;
        }

        // Allow common US phone formats while keeping lightweight front-end validation.
        const phonePattern = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        if (!phonePattern.test(phone)) {
            formMessage.textContent = 'Please enter a valid phone number so I can reach you.';
            formMessage.classList.add('error');
            return false;
        }

        return true;
    }
});