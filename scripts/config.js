const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Local development can use same-origin/auto-detected backend from main.js.
// For production, set this to your deployed API origin.
window.SFP_API_BASE_URL = isLocalHost ? '' : 'https://8l05v5bp28.execute-api.us-east-1.amazonaws.com';
