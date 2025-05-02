// Initialize variables
const productsContainer = document.getElementById('products-container');
const toastContainer = document.getElementById('toast-container');
const filterButtons = document.querySelectorAll('[data-filter]');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

// Mock data for development
const MOCK_DATA = {
    products: [
        {
            id: 1,
            name: "Professional Power Drill",
            price: 119.99,
            category: "tools",
            description: "Heavy duty cordless drill with battery pack",
            stock: 10,
            imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407"
        },
        // Add more mock products...
    ]
};

// API config
const API_CONFIG = {
    useMockData: false, // Change to false to use real API
    baseUrl: 'http://localhost:3000/api'
};

// Add loading spinner to body
document.body.insertAdjacentHTML('beforeend', `
    <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin fa-3x"></i>
    </div>
`);

function showLoading() {
    document.querySelector('.loading-spinner').classList.add('active');
}

function hideLoading() {
    document.querySelector('.loading-spinner').classList.remove('active');
}

// Updated fetch products function
async function fetchProducts() {
    showLoading();
    try {
        if (API_CONFIG.useMockData) {
            // Use mock data
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
            return MOCK_DATA.products;
        }

        const response = await fetch(`${API_CONFIG.baseUrl}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        showToast('Using sample data for demonstration', 'info');
        return MOCK_DATA.products;
    } finally {
        hideLoading();
    }
}

// Check authentication and admin status
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');

    // Check if user is logged in and has valid token
    if (!token || !user.role) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return;
    }

    // Update UI based on user role
    const adminLinks = document.querySelectorAll('.admin-link');
    adminLinks.forEach(link => {
        link.style.display = user.role === 'admin' ? 'block' : 'none';
    });

    updateUserMenu(user);
}

// Initialize page with products
async function initializePage() {
    const products = await fetchProducts();
    // Update products display
    productsContainer.innerHTML = '';
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');
        productCard.setAttribute('data-category', product.category);
        productCard.innerHTML = `
            <h5>${product.name}</h5>
            <p>${product.description}</p>
        `;
        productsContainer.appendChild(productCard);
    });
}

// Filter products
filterButtons.forEach(button => {
    button.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');

        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Filter products
        const products = productsContainer.querySelectorAll('[data-category]');
        products.forEach(product => {
            if (filter === 'all' || product.getAttribute('data-category') === filter) {
                product.style.display = 'block';
            } else {
                product.style.display = 'none';
            }
        });
    });
});

// Search functionality
searchButton.addEventListener('click', function() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm.length > 0) {
        showToast(`Searching for "${searchTerm}"...`, 'info');
        // In a real app, this would trigger a search API call
    }
});

// Enter key for search
searchInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        searchButton.click();
    }
});

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', 'show', 'my-2');

    // Toast color based on type
    let bgColor = 'bg-primary';
    if (type === 'success') bgColor = 'bg-success';
    if (type === 'danger') bgColor = 'bg-danger';
    if (type === 'warning') bgColor = 'bg-warning text-dark';
    if (type === 'info') bgColor = 'bg-info text-dark';

    toast.innerHTML = `
        <div class="toast-header ${bgColor} text-white">
            <strong class="me-auto">BuildMart</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Animate on scroll
document.addEventListener('DOMContentLoaded', function() {
    const scrollElements = document.querySelectorAll('.category-card, .product-card');

    const elementInView = (el, offset = 0) => {
        const elementTop = el.getBoundingClientRect().top;
        return (
            elementTop <= 
            (window.innerHeight || document.documentElement.clientHeight) - offset
        );
    };

    const displayScrollElement = (element) => {
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
    };

    const hideScrollElement = (element) => {
        element.style.opacity = "0";
        element.style.transform = "translateY(20px)";
    };

    const handleScrollAnimation = () => {
        scrollElements.forEach((el) => {
            if (elementInView(el, 100)) {
                displayScrollElement(el);
            } else {
                hideScrollElement(el);
            }
        });
    };

    scrollElements.forEach((el) => {
        hideScrollElement(el);
    });

    window.addEventListener("scroll", () => {
        handleScrollAnimation();
    });

    // Initial check
    handleScrollAnimation();

    // Initialize page with products
    initializePage();

    // Check authentication and admin status
    checkAuth();

    // Call loadPopularProducts after initialization
    loadPopularProducts();
});

// Updated auth functions
async function handleAuth(endpoint, data) {
    try {
        showLoading();
        
        const response = await fetch(`${API_CONFIG.baseUrl}/auth/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `${endpoint} failed`);
        }

        if (result.user && result.user.role) {
            localStorage.setItem('user', JSON.stringify(result.user));
            localStorage.setItem('token', result.token);
        }

        return result;
    } catch (error) {
        console.error(`Auth error (${endpoint}):`, error);
        throw error;
    } finally {
        hideLoading();
    }
}

// Auth related code
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (!token) {
        // Show login modal after 2 seconds
        setTimeout(() => {
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        }, 2000);
    }

    // Update login form handler
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const data = await handleAuth('login', loginData);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            showToast('Login successful!', 'success');
            checkAuth();
        } catch (error) {
            showToast('Login failed. Please try again.', 'danger');
        }
    });

    // Handle signup form submission
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const name = (formData.get('name') || '').trim();
        const email = (formData.get('email') || '').trim();
        const password = (formData.get('password') || '').trim();
        const confirmPassword = (formData.get('confirmPassword') || '').trim();

        if (!name || !email || !password || !confirmPassword) {
            showToast('All fields are required', 'danger');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'danger');
            return;
        }

        const signupData = {
            name,
            email,
            password
        };

        // Debug log for registration data
        console.log('Sending registration data:', signupData);

        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupData)
            });

            const result = await response.json();

            if (!response.ok) {
                showToast(result.error || 'Registration failed. Please try again.', 'danger');
                return;
            }

            showToast('Registration successful! Please login.', 'success');
            toggleModals('signupModal', 'loginModal');
        } catch (error) {
            showToast('Registration failed. Please try again.', 'danger');
        }
    });
});

// Toggle between login and signup modals
function toggleModals(closeModalId, openModalId) {
    const closeModal = bootstrap.Modal.getInstance(document.getElementById(closeModalId));
    const openModal = new bootstrap.Modal(document.getElementById(openModalId));
    
    closeModal.hide();
    setTimeout(() => {
        openModal.show();
    }, 400);
}

// Update user menu
function updateUserMenu(user) {
    const userIcon = document.querySelector('.fa-user').parentElement;
    if (user?.name) {
        userIcon.className = 'position-relative user-menu';
        userIcon.innerHTML = `
            <i class="fas fa-user fa-lg text-secondary"></i>
            <div class="user-dropdown">
                <div class="user-dropdown-header">
                    <div class="user-dropdown-name">${user.name}</div>
                    <div class="user-dropdown-email">${user.email}</div>
                </div>
                <div class="user-dropdown-items">
                    <a href="#" class="user-dropdown-item">
                        <i class="fas fa-user-circle"></i>
                        My Profile
                    </a>
                    <a href="#" class="user-dropdown-item">
                        <i class="fas fa-shopping-bag"></i>
                        My Orders
                    </a>
                    <a href="#" class="user-dropdown-item">
                        <i class="fas fa-heart"></i>
                        Wishlist
                    </a>
                    ${user.role === 'admin' ? `
                        <a href="admin/admin.html" class="user-dropdown-item admin-item">
                            <i class="fas fa-user-shield"></i>
                            Admin Panel
                        </a>
                    ` : ''}
                    <div class="user-dropdown-divider"></div>
                    <a href="#" class="user-dropdown-item" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </a>
                </div>
            </div>
        `;

        // Add click handler to toggle dropdown
        userIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
        });
    } else {
        userIcon.className = 'position-relative';
        userIcon.innerHTML = '<i class="fas fa-user fa-lg text-secondary"></i>';
        userIcon.onclick = () => {
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        };
    }
}

// Add click handler for document to close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const userMenu = document.querySelector('.user-menu');
    if (userMenu && !e.target.closest('.user-menu')) {
        userMenu.classList.remove('active');
    }
});

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Logged out successfully', 'info');
    checkAuth();
    window.location.reload();
}

// Load popular products
async function loadPopularProducts() {
    try {
        showLoading();
        const response = await fetch(`${API_CONFIG.baseUrl}/products`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const products = await response.json();
        if (!Array.isArray(products)) {
            throw new Error('Invalid data received from server');
        }

        // Get the popular products container
        const productsContainer = document.getElementById('products-container');
        
        // Clear existing content
        productsContainer.innerHTML = '';
        
        // Display up to 8 products
        const displayProducts = products.slice(0, 8);
        
        if (displayProducts.length === 0) {
            productsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <p>No products found</p>
                </div>
            `;
            return;
        }

        displayProducts.forEach(product => {
            const productCard = `
                <div class="col-sm-6 col-lg-3" data-category="${product.category}">
                    <div class="product-card bg-white rounded-lg shadow-sm overflow-hidden">
                        <div class="position-relative">
                            <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=Product+Image'}" 
                                 alt="${product.name}" 
                                 class="img-fluid w-full"
                                 onerror="this.src='https://via.placeholder.com/300x200?text=Product+Image'">
                            ${product.discount ? `
                                <span class="position-absolute top-0 start-0 bg-success text-white px-2 py-1 m-2 rounded-pill small">
                                    ${product.discount}% Off
                                </span>
                            ` : ''}
                            <button class="position-absolute top-0 end-0 btn btn-light rounded-circle m-2 p-2 shadow-sm">
                                <i class="far fa-heart"></i>
                            </button>
                        </div>
                        <div class="p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge bg-light text-dark">${product.category}</span>
                                <div>
                                    <i class="fas fa-star text-warning"></i>
                                    <span class="small">${product.rating || '4.5'}</span>
                                </div>
                            </div>
                            <h5 class="fw-bold mb-1">${product.name}</h5>
                            <p class="text-secondary small mb-2">${product.description}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    ${product.oldPrice ? `
                                        <span class="text-decoration-line-through text-secondary me-2">₹${product.oldPrice}</span>
                                    ` : ''}
                                    <span class="fw-bold text-primary">₹${product.price}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            productsContainer.insertAdjacentHTML('beforeend', productCard);
        });

    } catch (error) {
        console.error('Error loading popular products:', error);
        const productsContainer = document.getElementById('products-container');
        productsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Failed to load products. Please try again later.
                    <button class="btn btn-outline-danger ms-3" onclick="loadPopularProducts()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            </div>
        `;
    } finally {
        hideLoading();
    }
}
