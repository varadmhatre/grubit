// ===================== FIREBASE (AUTH ONLY) =====================
// Put your real config here
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCR01N7CSB7OfB8VxHzkV725Zeo7ct-ibA",
  authDomain: "grubit-45d09.firebaseapp.com",
  projectId: "grubit-45d09",
  storageBucket: "grubit-45d09.firebasestorage.app",
  messagingSenderId: "787109161650",
  appId: "1:787109161650:web:bb9a0f8f321f8a75bb77ab",
  measurementId: "G-3P7M922KET"
};

if (typeof firebase === "undefined") {
  console.error("Firebase SDK not loaded");
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // ONLY auth, no Firestore

// ===================== SMALL HELPERS =====================

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return document.querySelectorAll(sel);
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"), 50);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function isValidGmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  return regex.test(email);
}

// ===================== LOCAL STORAGE LAYER =====================
// We store products and cart locally on the device

function loadProducts() {
  try {
    return JSON.parse(localStorage.getItem("qf_products") || "[]");
  } catch (e) {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem("qf_products", JSON.stringify(products));
}

function loadCart(userId) {
  try {
    return JSON.parse(localStorage.getItem("qf_cart_" + userId) || "[]");
  } catch (e) {
    return [];
  }
}

function saveCart(userId, items) {
  localStorage.setItem("qf_cart_" + userId, JSON.stringify(items));
}

function createProduct({ title, price, desc, imageUrl, ownerId }) {
  const products = loadProducts();
  const id = "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  const product = {
    id,
    title,
    price,
    desc,
    imageUrl: imageUrl || "https://via.placeholder.com/300x200?text=Stationery",
    ownerId,
    published: false,
    createdAt: Date.now()
  };
  products.push(product);
  saveProducts(products);
  return product;
}

function togglePublishProduct(id) {
  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  products[idx].published = !products[idx].published;
  saveProducts(products);
  return products[idx];
}

// ===================== EMAILJS WELCOME (OPTIONAL) =====================

async function sendWelcomeEmail(email, name) {
  if (!window.emailjs) return; // fail silently if not available
  try {
    await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
      user_email: email,
      user_name: name
    });
    console.log("Welcome email sent");
  } catch (err) {
    console.error("EmailJS error:", err);
  }
}

// ===================== AUTH & ROUTING =====================

async function handleSignup(e) {
  e.preventDefault();
  const name = $("#signup-name").value.trim();
  const email = $("#signup-email").value.trim().toLowerCase();
  const pass = $("#signup-password").value.trim();
  const role = document.querySelector('input[name="signup-role"]:checked')?.value;

  if (!name || !email || !pass || !role) {
    showToast("Fill all fields & select role.", "error");
    return;
  }
  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address.", "error");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await sendWelcomeEmail(email, name);

    // Save role locally (since we removed Firestore)
    localStorage.setItem("qf_role_" + cred.user.uid, role);
    localStorage.setItem("sb_user_uid", cred.user.uid);
    localStorage.setItem("sb_user_email", cred.user.email);

    showToast("Signup successful!", "success");

    if (role === "seller") {
      window.location.href = "seller.html";
    } else {
      window.location.href = "customer.html";
    }
  } catch (err) {
    console.error("Signup error:", err);
    showToast(err.message, "error");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $("#login-email").value.trim().toLowerCase();
  const pass = $("#login-password").value.trim();

  if (!email || !pass) {
    showToast("Enter email & password.", "error");
    return;
  }
  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address.", "error");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);

    const uid = cred.user.uid;
    const role = localStorage.getItem("qf_role_" + uid) || "customer";

    localStorage.setItem("sb_user_uid", uid);
    localStorage.setItem("sb_user_email", cred.user.email);

    showToast("Login successful!", "success");

    if (role === "seller") {
      window.location.href = "seller.html";
    } else {
      window.location.href = "customer.html";
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast(err.message, "error");
  }
}

function handleLogout() {
  auth.signOut().then(() => {
    localStorage.removeItem("sb_user_uid");
    localStorage.removeItem("sb_user_email");
    showToast("Logged out.", "info");
    window.location.href = "index.html";
  });
}

// For protected pages
function requireAuth(pageInitFn) {
  auth.onAuthStateChanged(user => {
    const currentPage = document.body.dataset.page;
    if (!user) {
      // Kick to login if not on login page
      if (currentPage !== "login") {
        window.location.href = "index.html";
      }
      return;
    }
    localStorage.setItem("sb_user_uid", user.uid);
    localStorage.setItem("sb_user_email", user.email);
    pageInitFn(user);
  });
}

// ===================== SELLER PAGE LOGIC =====================

function initSellerPage(user) {
  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const form = $("#product-form");
  const list = $("#seller-products");

  function renderSellerProducts() {
    const products = loadProducts()
      .filter(p => p.ownerId === user.uid)
      .sort((a, b) => b.createdAt - a.createdAt);

    list.innerHTML = "";
    if (!products.length) {
      list.innerHTML = `<p class="muted">You haven't added any products yet.</p>`;
      return;
    }

    products.forEach(p => {
      const card = document.createElement("div");
      card.className = "card product-card";
      card.innerHTML = `
        <img src="${p.imageUrl}" alt="${p.title}">
        <div class="card-content">
          <h3>${p.title}</h3>
          <p class="muted">${p.desc}</p>
          <p class="price">$${p.price.toFixed(2)}</p>
          <div class="product-actions">
            <span class="status-pill ${p.published ? "published" : "draft"}">
              ${p.published ? "Published" : "Draft"}
            </span>
            <button class="btn btn-small toggle-publish" data-id="${p.id}">
              ${p.published ? "Unpublish" : "Publish"}
            </button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    $all(".toggle-publish").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const updated = togglePublishProduct(id);
        if (updated) {
          showToast(updated.published ? "Product published!" : "Product hidden.", "success");
          renderSellerProducts();
        }
      };
    });
  }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const title = $("#prod-title").value.trim();
      const price = parseFloat($("#prod-price").value);
      const desc = $("#prod-desc").value.trim();
      const imageUrl = $("#prod-image").value.trim();

      if (!title || !price || !desc) {
        showToast("Fill all product fields.", "error");
        return;
      }

      createProduct({ title, price, desc, imageUrl, ownerId: user.uid });
      form.reset();
      showToast("Product saved as draft.", "success");
      renderSellerProducts();
    });
  }

  renderSellerProducts();
}

// ===================== CUSTOMER PAGE LOGIC =====================

function initCustomerPage(user) {
  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const cartBtn = $("#go-cart-btn");
  if (cartBtn) cartBtn.addEventListener("click", () => {
    window.location.href = "cart.html";
  });

  const list = $("#product-list");

  function renderCustomerProducts() {
    const products = loadProducts()
      .filter(p => p.published)
      .sort((a, b) => b.createdAt - a.createdAt);

    list.innerHTML = "";
    if (!products.length) {
      list.innerHTML = `<p class="muted">No stationery items available yet.</p>`;
      return;
    }

    products.forEach(p => {
      const card = document.createElement("div");
      card.className = "card product-card";
      card.innerHTML = `
        <img src="${p.imageUrl}" alt="${p.title}">
        <div class="card-content">
          <h3>${p.title}</h3>
          <p class="muted">${p.desc}</p>
          <div class="card-footer">
            <span class="price">$${p.price.toFixed(2)}</span>
            <button class="btn btn-small add-to-cart" data-id="${p.id}">
              Add to cart
            </button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    $all(".add-to-cart").forEach(btn => {
      btn.onclick = () => addToCart(user.uid, btn.dataset.id);
    });
  }

  renderCustomerProducts();
}

function addToCart(userId, productId) {
  const products = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) {
    showToast("Product not found.", "error");
    return;
  }

  let items = loadCart(userId);
  const idx = items.findIndex(i => i.productId === productId);
  if (idx >= 0) {
    items[idx].qty += 1;
  } else {
    items.push({ productId, qty: 1 });
  }
  saveCart(userId, items);
  showToast("Added to cart.", "success");
}

// ===================== CART PAGE LOGIC =====================

function initCartPage(user) {
  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const container = $("#cart-items");
  const totalEl = $("#cart-total");
  const checkoutBtn = $("#checkout-btn");

  function renderCart() {
    const products = loadProducts();
    const items = loadCart(user.uid);

    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      totalEl.textContent = "$0.00";
      return;
    }

    let total = 0;
    items.forEach(item => {
      const p = products.find(pr => pr.id === item.productId);
      if (!p) return;
      const lineTotal = p.price * item.qty;
      total += lineTotal;

      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div class="cart-info">
          <h4>${p.title}</h4>
          <p class="muted">$${p.price.toFixed(2)} × ${item.qty}</p>
        </div>
        <div class="cart-actions">
          <span class="price">$${lineTotal.toFixed(2)}</span>
          <div class="qty-controls">
            <button class="qty-btn" data-id="${p.id}" data-action="dec">−</button>
            <button class="qty-btn" data-id="${p.id}" data-action="inc">+</button>
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;

    $all(".qty-btn").forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        let items = loadCart(user.uid);
        const idx = items.findIndex(i => i.productId === id);
        if (idx === -1) return;
        if (action === "inc") {
          items[idx].qty += 1;
        } else {
          items[idx].qty -= 1;
          if (items[idx].qty <= 0) items.splice(idx, 1);
        }
        saveCart(user.uid, items);
        renderCart();
      };
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      showToast("Order placed! (local demo)", "success");
      // Clear cart after fake checkout
      saveCart(user.uid, []);
      renderCart();
    });
  }

  renderCart();
}

// ===================== PAGE BOOTSTRAP =====================

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "login") {
    const signupForm = $("#signup-form");
    const loginForm = $("#login-form");
    if (signupForm) signupForm.addEventListener("submit", handleSignup);
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    return;
  }

  // Protected pages
  if (page === "seller") {
    requireAuth(initSellerPage);
  } else if (page === "customer") {
    requireAuth(initCustomerPage);
  } else if (page === "cart") {
    requireAuth(initCartPage);
  }
});
