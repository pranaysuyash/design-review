// main.js
const API_BASE_URL = 'http://127.0.0.1:5001';

document.addEventListener('DOMContentLoaded', function () {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
        console.error('Unhandled promise rejection:', event.reason);
        showError('An unexpected error occurred. Please try again.');
        event.preventDefault();
    });

    // Cache DOM elements
    const form = document.getElementById('uploadForm');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const reviewContent = document.getElementById('reviewContent');
    const submitBtn = document.getElementById('submitBtn');
    const emailForm = document.getElementById('emailForm');
    const setEmailBtn = document.getElementById('setEmailBtn');
    const contextArea = document.getElementById('context');
    const contextCharCount = document.getElementById('contextCharCount');
    const supporterStatus = document.getElementById('supporterStatus');

    // Show loading overlay
    function showLoading() {
        if (loading) {
            loading.classList.add('active');
            if (result) result.classList.add('d-none');
            if (error) error.classList.add('d-none');

            const progressBar = loading.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
                let progress = 0;
                const interval = setInterval(() => {
                    progress += Math.random() * 15;
                    if (progress > 90) {
                        clearInterval(interval);
                        progress = 90;
                    }
                    progressBar.style.width = `${progress}%`;
                }, 500);
            }
        }
    }

    // Hide loading overlay
    function hideLoading() {
        if (loading) {
            const progressBar = loading.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
            }

            setTimeout(() => {
                loading.classList.remove('active');
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
            }, 500);
        }
    }

    // Show error message
    function showError(message) {
        if (error) {
            error.innerHTML = `
                <div class="alert alert-danger d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>${message}</div>
                </div>
            `;
            error.classList.remove('d-none');
            if (result) result.classList.add('d-none');
            error.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Show review result
    async function showResult(reviewData) {
        try {
            console.log('Processing review data:', reviewData);

            if (result && reviewContent) {
                result.classList.remove('d-none');

                const premiumBadge = reviewData.is_premium ?
                    `<span class="badge bg-warning text-dark ms-2">Premium Analysis</span>` : '';

                reviewContent.innerHTML = `
                    <div class="review-section mb-4 ${reviewData.is_premium ? 'premium-review' : ''}">
                        <h4 class="section-header">
                            <i class="bi bi-info-circle me-2"></i>Overview
                            ${premiumBadge}
                        </h4>
                        <div class="section-content p-3">
                            ${reviewData.overview}
                        </div>
                    </div>
                    
                    <div class="review-section mb-4">
                        <h4 class="section-header">
                            <i class="bi bi-check-circle me-2 text-success"></i>Strengths
                        </h4>
                        <div class="section-content p-3">
                            <ul class="list-unstyled mb-0">
                                ${reviewData.strengths.map(strength =>
                    `<li class="mb-2">• ${strength}</li>`
                ).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="review-section mb-4">
                        <h4 class="section-header">
                            <i class="bi bi-exclamation-circle me-2 text-warning"></i>Areas for Improvement
                        </h4>
                        <div class="section-content p-3">
                            <ul class="list-unstyled mb-0">
                                ${reviewData.improvements.map(improvement =>
                    `<li class="mb-2">• ${improvement}</li>`
                ).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="review-section">
                        <h4 class="section-header">
                            <i class="bi bi-lightbulb me-2 text-info"></i>Strategic Recommendations
                        </h4>
                        <div class="section-content p-3">
                            ${reviewData.recommendations}
                        </div>
                    </div>
                `;

                result.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Error displaying review:', err);
            throw new Error('Failed to display the review. Please try again.');
        }
    }

    // Enhanced fetch with retry
    async function fetchWithRetry(url, options, maxRetries = 3) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, {
                    ...options,
                    credentials: 'include'
                });

                const data = await response.json();
                console.log('Server response:', data);

                if (!response.ok) {
                    throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
                }

                return data;
            } catch (err) {
                console.error(`Attempt ${i + 1} failed:`, err);
                lastError = err;

                if (i === maxRetries - 1) {
                    throw err;
                }

                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
        }

        throw lastError;
    }

    // Update supporter status display
    function updateSupporterStatus(status) {
        if (supporterStatus) {
            supporterStatus.innerHTML = status.is_supporter ?
                `<div class="premium-badge glass-effect">
                    <span class="badge-icon">⭐</span>
                    Premium Member
                    <div class="rate-limit">15 reviews/day</div>
                </div>` :
                `<div class="alert alert-info">
                    <h5 class="alert-heading">Free Tier</h5>
                    <p class="mb-0">
                        <a href="https://www.buymeacoffee.com/pranaysuyash" 
                           target="_blank" class="alert-link">
                            Become a supporter
                        </a> 
                        to unlock premium features and detailed analysis
                    </p>
                </div>`;
            supporterStatus.classList.remove('d-none');
        }
    }

    // Update rate info display
    function updateRateInfo(rateInfo) {
        const rateInfoElements = document.querySelectorAll('.requests-remaining');
        rateInfoElements.forEach(element => {
            element.textContent = `${rateInfo.requests_used}/${rateInfo.requests_limit}`;
        });
    }

    // Handle email submission
    if (setEmailBtn) {
        setEmailBtn.addEventListener('click', async function () {
            try {
                const emailInput = document.getElementById('email');
                const email = emailInput.value.trim();

                if (!email) {
                    throw new Error('Please enter your email address');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Please enter a valid email address');
                }

                setEmailBtn.disabled = true;

                const formData = new FormData();
                formData.append('email', email);

                const data = await fetchWithRetry('/set-email', {
                    method: 'POST',
                    body: formData
                });

                if (data.supporter_status) {
                    updateSupporterStatus(data.supporter_status);
                    updateRateInfo(data.rate_info);
                }

                if (error) error.classList.add('d-none');

            } catch (err) {
                showError(err.message || 'Failed to set email');
            } finally {
                setEmailBtn.disabled = false;
            }
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            try {
                const file = document.getElementById('image').files[0];
                if (!file) {
                    throw new Error('Please select an image file');
                }

                // Validate file
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('File size must be less than 5MB');
                }

                const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
                if (!validTypes.includes(file.type)) {
                    throw new Error('Please upload a JPEG or PNG image');
                }

                console.log('Submitting file:', file);
                console.log('File details:', {
                    name: file.name,
                    type: file.type,
                    size: file.size
                });

                const formData = new FormData();
                formData.append('image', file);

                const context = document.getElementById('context').value.trim();
                formData.append('context', context);

                showLoading();
                submitBtn.disabled = true;

                const data = await fetchWithRetry('/analyze', {
                    method: 'POST',
                    body: formData
                });

                console.log('Review data received:', data);

                if (data.error) {
                    throw new Error(data.message || data.error);
                }

                await showResult(data.review);

                if (data.rate_info) {
                    updateRateInfo(data.rate_info);
                }

            } catch (err) {
                console.error('Error processing request:', err);
                showError(err.message || 'An unexpected error occurred');
            } finally {
                hideLoading();
                submitBtn.disabled = false;
            }
        });
    }

    // Context character counter
    if (contextArea) {
        contextArea.addEventListener('input', function () {
            const count = this.value.length;
            if (contextCharCount) {
                contextCharCount.textContent = count;
            }
            if (count > 500) {
                this.value = this.value.substring(0, 500);
            }
        });
    }

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Cleanup function
    function cleanup() {
        tooltipTriggerList.forEach(el => {
            const tooltip = bootstrap.Tooltip.getInstance(el);
            if (tooltip) {
                tooltip.dispose();
            }
        });

        if (form) form.reset();
        if (emailForm) emailForm.reset();
        if (error) error.classList.add('d-none');

        if (loading && loading.classList.contains('active')) {
            hideLoading();
        }
    }

    // Add cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
});