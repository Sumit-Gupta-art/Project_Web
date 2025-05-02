require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);

// WebSocket setup
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://vaibhavgujite:vaibhavgujite@cluster0.yiz6r0t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        // Hash the password with cost factor 10
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    imageUrl: String,
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    discount: Number,
    oldPrice: Number,
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'unread' },
    createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        quantity: Number
    }],
    total: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
    type: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Order = mongoose.model('Order', orderSchema);
const Activity = mongoose.model('Activity', activitySchema);

// WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Set up ping interval
    const pingInterval = setInterval(() => {
        if (ws.isAlive === false) {
            clearInterval(pingInterval);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    }, 30000);
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('error', console.error);
    
    ws.on('close', () => {
        clearInterval(pingInterval);
        console.log('Client disconnected from WebSocket');
    });
});

// Broadcast to all clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(data));
            } catch (error) {
                console.error('WebSocket broadcast error:', error);
            }
        }
    });
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

mongoose.connection.on('connected', async () => {
    console.log('Mongoose connected to MongoDB');
    // Create admin user if not exists
    await createAdminUser();
    // Create some sample data if needed
    await createSampleData();
});

async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                name: 'Admin User',
                email: 'admin@buildmart.com',
                password: 'admin123',
                role: 'admin'
            });
            console.log('Admin user created');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

async function createSampleData() {
    try {
        // Create sample products if none exist
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            const products = [
                {
                    name: "Professional Power Drill",
                    description: "Heavy duty cordless drill with battery pack",
                    price: 119.99,
                    category: "tools",
                    imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407",
                    stock: 15,
                    rating: 4.5,
                    discount: 20,
                    oldPrice: 149.99
                },
                {
                    name: "Premium Cement",
                    description: "High-quality Portland cement for construction",
                    price: 12.50,
                    category: "materials",
                    imageUrl: "https://images.unsplash.com/photo-1581783898377-1c85bf937427",
                    stock: 100,
                    rating: 4.8
                },
                {
                    name: "Safety Helmet",
                    description: "Premium construction safety helmet with adjustable fit",
                    price: 29.99,
                    category: "safety",
                    imageUrl: "https://images.unsplash.com/photo-1601995538676-40ad0fee5c7e",
                    stock: 50,
                    rating: 4.7
                },
                {
                    name: "Electric Wire Bundle",
                    description: "100m industrial grade copper wiring",
                    price: 89.99,
                    category: "electrical",
                    imageUrl: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5",
                    stock: 30,
                    rating: 4.9
                },
                {
                    name: "Premium Paint Set",
                    description: "Interior wall paint with primer, 5L",
                    price: 45.99,
                    category: "paint",
                    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f",
                    stock: 25,
                    rating: 4.6,
                    discount: 15,
                    oldPrice: 54.99
                }
            ];
            await Product.insertMany(products);
            console.log('Sample products created');
        }
        
        // Create sample contacts if none exist
        const contactCount = await Contact.countDocuments();
        if (contactCount === 0) {
            const contacts = [
                {
                    name: "John Smith",
                    email: "john@example.com",
                    message: "I'm looking for eco-friendly building materials for my home renovation project. Can you recommend some options?",
                    status: "unread",
                    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                },
                {
                    name: "Sarah Johnson",
                    email: "sarah@example.com",
                    message: "Hello, I'd like to know if you offer discounts for bulk orders of premium cement.",
                    status: "read",
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
                }
            ];
            await Contact.insertMany(contacts);
            console.log('Sample contacts created');
        }
        
        // Create sample orders if none exist
        const orderCount = await Order.countDocuments();
        if (orderCount === 0) {
            const products = await Product.find().limit(3);
            if (products.length >= 2) {
                const orders = [
                    {
                        customerName: "Michael Brown",
                        items: [
                            {
                                productId: products[0]._id,
                                name: products[0].name,
                                price: products[0].price,
                                quantity: 2
                            },
                            {
                                productId: products[1]._id,
                                name: products[1].name,
                                price: products[1].price,
                                quantity: 3
                            }
                        ],
                        total: (products[0].price * 2) + (products[1].price * 3),
                        status: "processing",
                        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                    }
                ];
                if (products.length >= 3) {
                    orders.push({
                        customerName: "Emily Davis",
                        items: [
                            {
                                productId: products[2]._id,
                                name: products[2].name,
                                price: products[2].price,
                                quantity: 1
                            }
                        ],
                        total: products[2].price,
                        status: "delivered",
                        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
                    });
                }
                await Order.insertMany(orders);
                console.log('Sample orders created');
            }
        }
        
        // Create sample activities if none exist
        const activityCount = await Activity.countDocuments();
        if (activityCount === 0) {
            const activities = [
                {
                    type: "order",
                    message: "New order received from Michael Brown",
                    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                },
                {
                    type: "customer",
                    message: "New customer registered: Emily Davis",
                    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                },
                {
                    type: "product",
                    message: "Low stock alert: Premium Paint Set (5 remaining)",
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                },
                {
                    type: "inquiry",
                    message: "New inquiry from John Smith about eco-friendly materials",
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
                }
            ];
            await Activity.insertMany(activities);
            console.log('Sample activities created');
        }
        
    } catch (error) {
        console.error('Error creating sample data:', error);
    }
}

// API Endpoints

// Authentication
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });

        // Log activity
        if (user.role === 'admin') {
            await Activity.create({
                type: 'user',
                message: `Admin logged in: ${user.name || user.email}`
            });
        }

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        // Debug log for incoming registration data
        console.log('Registration request body:', req.body);

        // Trim input fields to avoid whitespace-only values
        const name = (req.body.name || '').trim();
        const email = (req.body.email || '').trim();
        const password = (req.body.password || '').trim();

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user - password will be hashed by pre-save hook
        const user = await User.create({
            name,
            email,
            password,
            role: 'user'
        });

        // Log activity
        await Activity.create({
            type: 'customer',
            message: `New customer registered: ${name || email}`
        });

        // Broadcast user count update
        const totalCustomers = await User.countDocuments({ role: 'user' });
        broadcast({
            type: 'STATS_UPDATE',
            stats: { totalCustomers }
        });

        res.json({
            success: true,
            message: 'Registration successful'
        });
    } catch (error) {
        // Handle duplicate key error (email)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
            console.error('Duplicate email registration:', error);
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Handle validation errors
        if (error.name === 'ValidationError') {
            console.error('Validation error:', error);
            return res.status(400).json({ error: error.message });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Admin check
app.get('/api/check-admin', authenticateToken, (req, res) => {
    res.json({ isAdmin: req.user.role === 'admin' });
});

// Products endpoints
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.post('/api/products', authenticateToken, isAdmin, async (req, res) => {
    try {
        const productData = req.body;
        const product = await Product.create(productData);
        
        // Log activity
        await Activity.create({
            type: 'product',
            message: `New product added: ${product.name}`
        });
        
        // Broadcast update
        const totalProducts = await Product.countDocuments();
        broadcast({
            type: 'STATS_UPDATE',
            stats: { totalProducts }
        });
        
        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.put('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const productData = req.body;
        const product = await Product.findByIdAndUpdate(id, productData, { new: true });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check for low stock
        if (product.stock <= 5) {
            broadcast({
                type: 'STOCK_ALERT',
                productName: product.name,
                stock: product.stock
            });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Log activity
        await Activity.create({
            type: 'product',
            message: `Product deleted: ${product.name}`
        });
        
        // Broadcast update
        const totalProducts = await Product.countDocuments();
        broadcast({
            type: 'STATS_UPDATE',
            stats: { totalProducts }
        });
        
        res.status(204).end();
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Contacts endpoints
app.get('/api/contacts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

app.post('/api/contacts', async (req, res) => {
    try {
        const contactData = req.body;
        const contact = await Contact.create(contactData);
        
        // Log activity
        await Activity.create({
            type: 'inquiry',
            message: `New inquiry from ${contact.name} about ${contact.message.substring(0, 30)}...`
        });
        
        // Broadcast update
        const totalInquiries = await Contact.countDocuments();
        broadcast({
            type: 'NEW_INQUIRY',
            totalInquiries
        });
        
        res.status(201).json(contact);
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

app.put('/api/contacts/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const contact = await Contact.findByIdAndUpdate(id, { status }, { new: true });
        
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        res.json(contact);
    } catch (error) {
        console.error('Error updating contact status:', error);
        res.status(500).json({ error: 'Failed to update contact status' });
    }
});

app.delete('/api/contacts/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await Contact.findByIdAndDelete(id);
        
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        // Broadcast update
        const totalInquiries = await Contact.countDocuments();
        broadcast({
            type: 'STATS_UPDATE',
            stats: { totalInquiries }
        });
        
        res.status(204).end();
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// Orders endpoints
app.get('/api/orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/orders/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

app.put('/api/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Log activity
        await Activity.create({
            type: 'order',
            message: `Order #${order._id.toString().slice(-6)} status updated to ${status}`
        });
        
        res.json(order);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Customers (users) endpoints
app.get('/api/customers', authenticateToken, isAdmin, async (req, res) => {
    try {
        const customers = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
        
        // Get order counts for each customer
        const customerData = await Promise.all(customers.map(async (customer) => {
            const orderCount = await Order.countDocuments({ customerId: customer._id });
            return {
                ...customer.toObject(),
                orderCount
            };
        }));
        
        res.json(customerData);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

app.get('/api/customers/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await User.findById(id).select('-password');
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Get customer's orders
        const orders = await Order.find({ customerId: id }).sort({ createdAt: -1 });
        
        res.json({
            customer,
            orders
        });
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Recent activity endpoint
app.get('/api/activity/recent', authenticateToken, isAdmin, async (req, res) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(10);
        res.json(activities);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Dashboard stats endpoint
app.get('/api/stats/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [
            totalProducts,
            totalCustomers,
            totalInquiries,
            orders
        ] = await Promise.all([
            Product.countDocuments(),
            User.countDocuments({ role: 'user' }),
            Contact.countDocuments(),
            Order.find()
        ]);
        
        const totalValue = orders.reduce((sum, order) => sum + order.total, 0);
        
        const stats = {
            totalProducts,
            totalCustomers,
            totalInquiries,
            totalValue
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Serve static files
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});