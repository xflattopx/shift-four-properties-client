document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('seller-form');
    const formMessage = document.getElementById('form-message');
    const submitButton = form.querySelector('button[type="submit"]');
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

            formMessage.textContent = 'Thanks for reaching out. I will contact you soon with next steps.';
            formMessage.classList.add('success');
            form.reset();
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