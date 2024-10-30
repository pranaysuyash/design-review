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
    function showResult(reviewData) {
        try {
            if (result && reviewContent) {
                result.classList.remove('d-none');

                // Ensure we have valid review content
                if (!reviewData?.review_content) {
                    throw new Error('No review content available');
                }

                // Configure DOMPurify
                const purifyConfig = {
                    ALLOWED_TAGS: ['div', 'h1', 'h2', 'h3', 'p', 'i', 'span', 'strong'],
                    ALLOWED_ATTR: ['class']
                };

                // Process the review content
                const sections = reviewData.review_content.split(/(?=# )/g).filter(Boolean);
                let htmlContent = '<div class="review-wrapper">';

                sections.forEach(section => {
                    const lines = section.split('\n').filter(Boolean);
                    const titleLine = lines[0];
                    const sectionTitle = titleLine.replace('# ', '').trim();
                    const content = lines.slice(1);

                    // Determine icon and class based on section type
                    let iconClass = 'bi-info-circle';
                    let textColorClass = 'text-blue-400';

                    if (sectionTitle.toLowerCase().includes('strength')) {
                        iconClass = 'bi-check-circle';
                        textColorClass = 'text-green-400';
                    } else if (sectionTitle.toLowerCase().includes('improvement') ||
                        sectionTitle.toLowerCase().includes('enhancement')) {
                        iconClass = 'bi-exclamation-triangle';
                        textColorClass = 'text-yellow-400';
                    } else if (sectionTitle.toLowerCase().includes('suggestion') ||
                        sectionTitle.toLowerCase().includes('recommend')) {
                        iconClass = 'bi-lightbulb';
                        textColorClass = 'text-purple-400';
                    }

                    htmlContent += `
                        <div class="review-section mb-6">
                            <div class="section-header">
                                <i class="bi ${iconClass} ${textColorClass} text-xl"></i>
                                <h2 class="section-title ${textColorClass} text-xl font-semibold">${sectionTitle}</h2>
                            </div>
                            <div class="section-content text-gray-200">`;

                    let currentIndentLevel = 0;
                    let inBulletList = false;

                    content.forEach(line => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) {
                            htmlContent += '<div class="my-2"></div>';
                            return;
                        }

                        // Calculate indentation level
                        const indentMatch = line.match(/^\s*/);
                        const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

                        if (trimmedLine.startsWith('• ')) {
                            // Handle bullet points
                            const bulletContent = trimmedLine.substring(2);
                            htmlContent += `
                                <div class="bullet-point ml-${indentLevel * 4} flex items-start gap-2 my-2">
                                    <span class="bullet-icon text-gray-400 mt-1">•</span>
                                    <p class="flex-1">${bulletContent}</p>
                                </div>`;
                        } else {
                            // Regular paragraph
                            htmlContent += `<p class="my-2 ml-${indentLevel * 4}">${trimmedLine}</p>`;
                        }
                    });

                    htmlContent += `
                            </div>
                        </div>`;
                });

                htmlContent += '</div>';

                // Sanitize and set the content
                reviewContent.innerHTML = DOMPurify.sanitize(htmlContent, purifyConfig);

                // Add premium indicator if applicable
                if (reviewData.is_premium) {
                    const premiumBadge = document.createElement('div');
                    premiumBadge.className = 'premium-badge text-sm py-1 px-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-full inline-flex items-center gap-2 mb-4';
                    premiumBadge.innerHTML = '<i class="bi bi-star-fill"></i> Premium Analysis';
                    reviewContent.insertBefore(premiumBadge, reviewContent.firstChild);
                }

                // Scroll to result
                result.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Error displaying review:', err);
            showError('Failed to display the review. Please try again.');
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
