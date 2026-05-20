import { 
    auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
    doc, setDoc, getDoc, deleteDoc, collection, addDoc, query, where, getDocs, orderBy
} from "./firebase-auth.js";

// --- State ---
let currentUser = null;
let items = [];
let logoBase64 = null;
let isLoginMode = true;
let allInvoices = []; 
let allCustomers = [];
let billingChart = null;
let currentCurrency = '$';

// --- Core Logic Functions (Internal & External) ---

function updatePreview() {
    console.log("Updating Preview... Items count:", items.length);
    const bizName = document.getElementById('biz-name').value || 'Business Name';
    const bizAddress = document.getElementById('biz-address').value || 'Address';
    const clientName = document.getElementById('client-name').value || 'Client Name';
    const clientAddress = document.getElementById('client-address').value || 'Address';
    const invNumber = document.getElementById('inv-number').value || 'INV-001';
    
    document.getElementById('prev-biz-name').textContent = bizName;
    document.getElementById('prev-biz-address').textContent = bizAddress;
    document.getElementById('prev-client-name').textContent = clientName;
    document.getElementById('prev-client-address').textContent = clientAddress;
    document.getElementById('prev-inv-number').textContent = invNumber;
    
    const status = document.getElementById('inv-status').value;
    const badge = document.getElementById('prev-status-badge');
    badge.textContent = status;
    badge.style.background = status === 'paid' ? '#dcfce7' : '#fef9c3';
    badge.style.color = status === 'paid' ? '#166534' : '#854d0e';

    const tbody = document.getElementById('prev-items-body');
    tbody.innerHTML = '';
    let subtotal = 0;
    
    items.forEach(item => {
        const total = (item.quantity || 0) * (item.price || 0);
        subtotal += total;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';
        tr.innerHTML = `
            <td style="padding: 0.75rem 0;">${item.description || 'Service'}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">${currentCurrency}${item.price.toFixed(2)}</td>
            <td style="text-align: right;">${currentCurrency}${total.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    const taxRate = parseFloat(document.getElementById('tax-rate').value) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const grandTotal = subtotal + taxAmount;
    
    document.getElementById('prev-subtotal').textContent = `${currentCurrency}${subtotal.toFixed(2)}`;
    document.getElementById('prev-tax-rate').textContent = taxRate;
    document.getElementById('prev-tax-amount').textContent = `${currentCurrency}${taxAmount.toFixed(2)}`;
    document.getElementById('prev-total').textContent = `${currentCurrency}${grandTotal.toFixed(2)}`;

    // Store numeric total for persistence
    window.currentNumericTotal = grandTotal;
}

function renderItems() {
    const container = document.getElementById('items-list');
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style.display = 'grid';
        div.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 40px';
        div.style.gap = '0.5rem';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
            <input type="text" value="${item.description}" placeholder="Description" oninput="updateItem(${item.id}, 'description', this.value)">
            <input type="number" value="${item.quantity}" oninput="updateItem(${item.id}, 'quantity', this.value)">
            <input type="number" value="${item.price}" oninput="updateItem(${item.id}, 'price', this.value)">
            <input type="text" value="${currentCurrency}${(item.quantity * item.price).toFixed(2)}" disabled>
            <button class="btn" style="color: var(--danger);" onclick="removeItem(${item.id})">×</button>
        `;
        container.appendChild(div);
    });
}

// --- Global Window Exports ---
window.updatePreview = updatePreview;
window.renderItems = renderItems;

window.switchTab = (tabId, element) => {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (element) element.classList.add('active');
    else {
        const link = document.querySelector(`.nav-link[onclick*="${tabId}"]`);
        if (link) link.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
    if (tabId === 'dashboard') updateDashboardStats();
};

window.handleLogout = async () => {
    try {
        await signOut(auth);
        showToast("Signed out successfully", "primary");
    } catch (e) {
        showToast("Logout failed", "danger");
    }
};

window.toggleDarkMode = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (target === 'dark') {
            icon.setAttribute('data-lucide', 'sun');
        } else {
            icon.setAttribute('data-lucide', 'moon');
        }
        if (window.lucide) window.lucide.createIcons();
    }
};

window.filterHistory = () => {
    const query = document.getElementById('history-search').value.toLowerCase();
    const filtered = allInvoices.filter(inv => 
        (inv.clientName || '').toLowerCase().includes(query) || 
        (inv.invNumber || '').toLowerCase().includes(query)
    );
    renderHistoryList(filtered);
};

window.updateCurrency = (val) => {
    currentCurrency = val;
    document.getElementById('inv-currency').value = val;
    document.getElementById('settings-currency').value = val;
    updatePreview();
    updateDashboardStats();
    renderHistoryList(allInvoices);
    if (currentUser) {
        setDoc(doc(db, "users", currentUser.uid), { currency: val }, { merge: true });
    }
};

window.handleLogoUpload = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            logoBase64 = e.target.result;
            const prevLogo = document.getElementById('prev-logo');
            prevLogo.src = logoBase64;
            prevLogo.style.display = 'block';
            updatePreview();
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.addItem = () => {
    items.push({ id: Date.now(), description: '', quantity: 1, price: 0 });
    renderItems();
    updatePreview();
};

window.removeItem = (id) => {
    items = items.filter(i => i.id !== id);
    renderItems();
    updatePreview();
};

window.updateItem = (id, field, value) => {
    const item = items.find(i => i.id === id);
    if (item) {
        if (field === 'quantity' || field === 'price') {
            item[field] = parseFloat(value) || 0;
        } else {
            item[field] = value;
        }
        updatePreview();
        const rows = document.querySelectorAll('.item-row');
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1 && rows[idx]) {
            const totalEl = rows[idx].querySelector('input[disabled]');
            if (totalEl) totalEl.value = `${currentCurrency}${(item.quantity * item.price).toFixed(2)}`;
        }
    }
};

window.saveInvoice = async () => {
    if (!currentUser) return showToast("Please sign in first", "danger");
    
    // Validation
    const bizName = document.getElementById('biz-name').value;
    const clientName = document.getElementById('client-name').value;
    const invDate = document.getElementById('inv-date').value;
    
    if (!bizName || !clientName) {
        return showToast("Business Name and Client Name are required", "danger");
    }
    if (items.length === 0) {
        return showToast("Please add at least one item", "danger");
    }

    const invData = {
        userId: currentUser.uid,
        date: invDate,
        bizName: bizName,
        bizAddress: document.getElementById('biz-address').value,
        clientName: clientName,
        clientAddress: document.getElementById('client-address').value,
        invNumber: document.getElementById('inv-number').value,
        taxRate: parseFloat(document.getElementById('tax-rate').value) || 0,
        status: document.getElementById('inv-status').value,
        currency: currentCurrency,
        logo: logoBase64,
        items: items,
        total: document.getElementById('prev-total').textContent,
        numericTotal: window.currentNumericTotal || 0,
        createdAt: new Date()
    };
    try {
        showToast("Saving...", "primary");
        await setDoc(doc(db, "users", currentUser.uid), {
            bizName: invData.bizName,
            bizAddress: invData.bizAddress,
            logo: logoBase64,
            currency: currentCurrency
        }, { merge: true });
        await addDoc(collection(db, "users", currentUser.uid, "invoices"), invData);
        showToast("Invoice saved!");
        await fetchAllInvoices(currentUser.uid);
        updateDashboardStats();
        setTimeout(() => window.switchTab('history'), 500);
    } catch (e) { showToast(`Save failed: ${e.message}`, "danger"); }
};

window.loadInvoice = (id) => {
    const inv = allInvoices.find(i => i.id === id);
    if (!inv) return;
    document.getElementById('client-name').value = inv.clientName || '';
    document.getElementById('client-address').value = inv.clientAddress || '';
    document.getElementById('inv-number').value = inv.invNumber || '';
    document.getElementById('inv-date').value = inv.date || '';
    document.getElementById('inv-status').value = inv.status || 'pending';
    document.getElementById('tax-rate').value = inv.taxRate || 0;
    document.getElementById('inv-currency').value = inv.currency || '$';
    currentCurrency = inv.currency || '$';
    logoBase64 = inv.logo || null;
    const prevLogo = document.getElementById('prev-logo');
    if (logoBase64) { prevLogo.src = logoBase64; prevLogo.style.display = 'block'; }
    else { prevLogo.style.display = 'none'; }
    items = JSON.parse(JSON.stringify(inv.items || []));
    renderItems();
    updatePreview();
    window.switchTab('editor');
    showToast(`Loaded ${inv.invNumber}`);
};

window.deleteInvoice = async (id) => {
    if (!confirm('Delete?')) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "invoices", id));
        showToast("Deleted", "danger");
        await fetchAllInvoices(currentUser.uid);
        updateDashboardStats();
    } catch (e) { showToast("Delete failed", "danger"); }
};

window.newInvoice = () => {
    if (confirm('Start new?')) {
        items = [];
        addItem();
        suggestNextInvoiceNumber();
        updatePreview();
    }
};

window.handleCustomerSelect = (id) => {
    if (!id) return;
    const cust = allCustomers.find(c => c.id === id);
    if (cust) {
        document.getElementById('client-name').value = cust.name;
        document.getElementById('client-address').value = cust.address;
        updatePreview();
        showToast(`Selected ${cust.name}`);
    }
};

window.saveCustomer = async () => {
    if (!currentUser) return;
    const name = document.getElementById('new-cust-name').value;
    const address = document.getElementById('new-cust-address').value;
    if (!name || !address) return showToast("Fields required", "danger");
    try {
        await addDoc(collection(db, "users", currentUser.uid, "customers"), { name, address, createdAt: new Date() });
        showToast("Customer saved!");
        document.getElementById('new-cust-name').value = '';
        document.getElementById('new-cust-address').value = '';
        await fetchAllCustomers(currentUser.uid);
    } catch (e) { showToast("Error", "danger"); }
};

window.deleteCustomer = async (id) => {
    if (!confirm('Delete?')) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "customers", id));
        showToast("Deleted", "danger");
        await fetchAllCustomers(currentUser.uid);
    } catch (e) { showToast("Error", "danger"); }
};

// --- Internal Helpers ---

async function fetchAllInvoices(uid) {
    try {
        const q = query(collection(db, "users", uid, "invoices"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHistoryList(allInvoices);
    } catch (e) { console.error(e); }
}

function renderHistoryList(invoices) {
    const container = document.getElementById('cloud-history-list');
    container.innerHTML = '';
    if (invoices.length === 0) {
        container.innerHTML = '<div class="card" style="text-align: center; color: var(--text-muted);">No invoices found.</div>';
        return;
    }
    invoices.forEach(inv => {
        const date = inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : 'N/A';
        const card = document.createElement('div');
        card.className = 'card stat-card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        let displayTotal = inv.total;
        const invCurrency = inv.currency || '$';
        if (!displayTotal.includes(invCurrency)) displayTotal = `${invCurrency}${displayTotal.replace(/[^\d.-]/g, '')}`;
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-weight: 700;">${inv.invNumber}</span>
                    <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 12px; font-weight: 800; text-transform: uppercase; background: ${inv.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${inv.status === 'paid' ? 'var(--success)' : 'var(--warning)'}; border: 1px solid currentColor;">${inv.status}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${inv.clientName || 'Unnamed'} • ${date}</div>
            </div>
            <div style="font-weight: 700; margin-right: 2rem;">${displayTotal}</div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-outline" style="padding: 0.4rem 0.75rem;" onclick="loadInvoice('${inv.id}')">Load</button>
                <button class="btn btn-outline" style="padding: 0.4rem 0.75rem; color: var(--danger);" onclick="deleteInvoice('${inv.id}')">×</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function fetchAllCustomers(uid) {
    try {
        const q = query(collection(db, "users", uid, "customers"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCustomerList();
        populateCustomerSelect();
    } catch (e) { console.error(e); }
}

function renderCustomerList() {
    const container = document.getElementById('customer-list');
    if (!container) return;
    container.innerHTML = '';
    if (allCustomers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No customers saved.</p>';
        return;
    }
    allCustomers.forEach(cust => {
        const div = document.createElement('div');
        div.className = 'card stat-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <div>
                <div style="font-weight: 700;">${cust.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${cust.address.substring(0, 40)}...</div>
            </div>
            <button class="btn btn-outline" style="color: var(--danger);" onclick="deleteCustomer('${cust.id}')">×</button>
        `;
        container.appendChild(div);
    });
}

function populateCustomerSelect() {
    const select = document.getElementById('pick-customer');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Saved Customer --</option>';
    allCustomers.forEach(cust => {
        const opt = document.createElement('option');
        opt.value = cust.id;
        opt.textContent = cust.name;
        select.appendChild(opt);
    });
}

function updateDashboardStats() {
    let total = 0, paid = 0, pending = 0;
    const monthlyData = {};
    allInvoices.forEach(inv => {
        const cleanTotal = inv.numericTotal !== undefined ? inv.numericTotal : (parseFloat(inv.total.replace(/[^\d.-]/g, '')) || 0);
        total += cleanTotal;
        if (inv.status === 'paid') paid += cleanTotal;
        else pending += cleanTotal;
        const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date();
        const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + cleanTotal;
    });
    document.getElementById('stat-total-billed').textContent = `${currentCurrency}${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('stat-paid').textContent = `${currentCurrency}${paid.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('stat-pending').textContent = `${currentCurrency}${pending.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    initChart(monthlyData);
}

function initChart(data) {
    const canvas = document.getElementById('billingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (billingChart) billingChart.destroy();
    const labels = Object.keys(data).reverse().slice(-6); 
    const values = labels.map(l => data[l]);
    billingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: `Billed (${currentCurrency})`, data: values, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 3, fill: true, tension: 0.4 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
    });
}

function suggestNextInvoiceNumber() {
    if (allInvoices.length === 0) return;
    const lastNum = allInvoices[0].invNumber;
    const match = lastNum.match(/\d+/);
    if (match) {
        const num = parseInt(match[0]) + 1;
        document.getElementById('inv-number').value = lastNum.replace(/\d+/, num.toString().padStart(match[0].length, '0'));
    }
}

async function loadUserData(uid) {
    const profileDoc = await getDoc(doc(db, "users", uid));
    if (profileDoc.exists()) {
        const data = profileDoc.data();
        document.getElementById('biz-name').value = data.bizName || '';
        document.getElementById('biz-address').value = data.bizAddress || '';
        if (data.currency) {
            currentCurrency = data.currency;
            document.getElementById('inv-currency').value = data.currency;
            document.getElementById('settings-currency').value = data.currency;
        }
        if (data.logo) {
            logoBase64 = data.logo;
            const prevLogo = document.getElementById('prev-logo');
            prevLogo.src = logoBase64;
            prevLogo.style.display = 'block';
        }
        updatePreview();
    }
}

function showToast(message, type = 'primary') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = `var(--${type})`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Auth Observers ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('main-content').style.filter = 'none';
        document.getElementById('main-content').style.pointerEvents = 'all';
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-initials').textContent = user.email.substring(0, 2).toUpperCase();
        await loadUserData(user.uid);
        await fetchAllInvoices(user.uid);
        await fetchAllCustomers(user.uid);
        updateDashboardStats();
        if (allInvoices.length === 0) document.getElementById('inv-number').value = 'INV-001';
        else suggestNextInvoiceNumber();
    } else {
        currentUser = null;
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('main-content').style.filter = 'blur(5px)';
        document.getElementById('main-content').style.pointerEvents = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const btnAuth = document.getElementById('btn-auth-action');
    if (btnAuth) {
        btnAuth.onclick = async () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            try {
                if (isLoginMode) await signInWithEmailAndPassword(auth, email, password);
                else await createUserWithEmailAndPassword(auth, email, password);
                showToast("Welcome!");
            } catch (e) { document.getElementById('auth-error').textContent = e.message; document.getElementById('auth-error').style.display = 'block'; }
        };
    }
    const switchLink = document.getElementById('auth-switch-link');
    if (switchLink) {
        switchLink.onclick = (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            document.getElementById('auth-title').textContent = isLoginMode ? "Welcome Back" : "Create Account";
            btnAuth.textContent = isLoginMode ? "Sign In" : "Sign Up";
            switchLink.textContent = isLoginMode ? "Sign Up" : "Sign In";
        };
    }
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
});
