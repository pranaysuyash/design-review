// main.js

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

    // Configure marked.js with custom renderer
    if (typeof marked !== 'undefined') {
        const renderer = new marked.Renderer();

        renderer.heading = function (text, level, raw, slugger) {
            // Ensure rawText is a string before calling toLowerCase
            const rawText = typeof raw === 'string' ? raw : text;
            // If you plan to use escapedText for IDs or other purposes, uncomment the next line
            // const escapedText = rawText.toLowerCase().replace(/[^\w]+/g, '-');

            return `
                <h${level} class="section-header level-${level}">
                    ${text}
                </h${level}>
            `;
        };

        marked.setOptions({
            renderer: renderer,
            highlight: function (code, lang) {
                if (typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return code;
            }
        });
    }

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

                // DOMPurify configuration
                const purifyConfig = {
                    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'hr', 'br', 'i', 'span'],
                    ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'style', 'align', 'aria-hidden']
                };

                // Ensure review_content is a string
                const markdownContent = typeof reviewData.review_content === 'string' ? reviewData.review_content : '';
                if (!markdownContent) {
                    throw new Error('Review content is empty or invalid.');
                }

                // Render markdown to HTML and sanitize it
                const rawHtml = marked.parse(markdownContent);
                const htmlContent = DOMPurify.sanitize(rawHtml, purifyConfig);

                reviewContent.innerHTML = htmlContent;

                // Post-processing to add icons
                const headers = reviewContent.querySelectorAll('.section-header');
                headers.forEach(header => {
                    const text = header.textContent.trim();
                    let iconClass = '';

                    if (text.includes('Overview')) {
                        iconClass = 'bi-info-circle';
                    } else if (text.includes('Strengths')) {
                        iconClass = 'bi-check-circle';
                    } else if (text.includes('Areas for Improvement')) {
                        iconClass = 'bi-exclamation-triangle';
                    } else if (text.includes('Suggestions') || text.includes('Specific Suggestions')) {
                        iconClass = 'bi-lightbulb';
                    } else if (text.includes('Benefits')) {
                        iconClass = 'bi-star';
                    }

                    if (iconClass) {
                        const iconElement = document.createElement('i');
                        iconElement.classList.add('bi', iconClass);
                        iconElement.setAttribute('aria-hidden', 'true');
                        iconElement.style.marginRight = '0.5rem';
                        header.prepend(iconElement);
                    }
                });

                // Syntax highlighting
                if (typeof hljs !== 'undefined') {
                    reviewContent.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }

                result.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Error displaying review:', err);
            showError(err.message || 'Failed to display the review. Please try again.');
        }
    }

    // Enhanced fetch with retry
    async function fetchWithRetry(url, options, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    credentials: 'include'
                });

                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const textData = await response.text();
                    throw new Error(`Expected JSON, got: ${textData}`);
                }

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

                // Exponential backoff
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
        }

        throw lastError;
    }

    // Update supporter status display
    function updateSupporterStatus(status) {
        if (supporterStatus) {
            if (status.is_supporter) {
                supporterStatus.innerHTML = `
                    <div class="premium-badge glass-effect">
                        <span class="badge-icon">⭐</span>
                        Premium Member
                        <div class="rate-limit">15 reviews/day</div>
                    </div>`;
            } else {
                supporterStatus.innerHTML = `
                    <div class="alert alert-info">
                        <h5 class="alert-heading">Free Tier</h5>
                        <p class="mb-0">
                            <a href="https://www.buymeacoffee.com/pranaysuyash" target="_blank" class="alert-link">
                                Become a supporter
                            </a> 
                            to unlock premium features and detailed analysis
                        </p>
                    </div>`;
            }
            supporterStatus.classList.remove('d-none');
        }
    }

    // Update rate info display
    function updateRateInfo(rateInfo) {
        const rateInfoElements = document.querySelectorAll('.requests-remaining');
        rateInfoElements.forEach(element => {
            element.textContent = `${rateInfo.requests_used}/${rateInfo.requests_limit} Reviews Used`;
        });
    }

    // Handle email submission
    if (setEmailBtn) {
        setEmailBtn.addEventListener('click', async function () {
            try {
                const emailInput = document.getElementById('email');
                const email = emailInput.value.trim();

                if (!email) {
                    throw new Error('Please enter your email address.');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Please enter a valid email address.');
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
                showError(err.message || 'Failed to set email.');
            } finally {
                setEmailBtn.disabled = false;
            }
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            console.log('Form submitted');

            try {
                const file = document.getElementById('image').files[0];
                console.log('Selected file:', file);

                if (!file) {
                    throw new Error('Please select an image file.');
                }

                // Validate file size
                if (file.size > 5 * 1024 * 1024) { // 5MB
                    throw new Error('File size must be less than 5MB.');
                }

                // Validate file type
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
                if (!validTypes.includes(file.type)) {
                    throw new Error('Please upload a JPEG or PNG image.');
                }

                console.log('Submitting file:', file);

                const formData = new FormData();
                formData.append('image', file);

                const context = document.getElementById('context').value.trim();
                formData.append('context', context);

                // Log formData entries for debugging
                console.log('FormData entries:');
                for (let pair of formData.entries()) {
                    console.log(`${pair[0]}:`, pair[1]);
                }

                showLoading();
                submitBtn.disabled = true;

                console.log('Before fetchWithRetry');
                const data = await fetchWithRetry('/analyze', {
                    method: 'POST',
                    body: formData
                });
                console.log('After fetchWithRetry');

                console.log('Review data received:', data);

                if (!data) {
                    throw new Error('No response received from the server.');
                }

                if (data.error) {
                    throw new Error(data.message || data.error);
                }

                await showResult(data.review);

                if (data.rate_info) {
                    updateRateInfo(data.rate_info);
                }

            } catch (err) {
                console.error('Error processing request:', err);
                showError(err.message || 'An unexpected error occurred.');
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
                // Optionally, provide visual feedback without truncating abruptly
                contextCharCount.classList.add('text-danger');
                // Truncate to 500 characters to prevent excessive input
                this.value = this.value.substring(0, 500);
            } else {
                contextCharCount.classList.remove('text-danger');
            }
        });
    }

    // Initialize tooltips
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Cleanup function
    function cleanup() {
        tooltipList.forEach(el => {
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
