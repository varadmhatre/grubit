// ===================== FIREBASE INIT =====================
// Replace this config with your project's actual Web config from Firebase Console
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
  console.error("Firebase SDK not loaded. Check script tags.");
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ===================== UTILITIES =====================

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

// ===================== EMAILJS (WELCOME EMAIL) =====================

async function sendWelcomeEmail(email, name) {
  if (!window.emailjs) return; // safe no-op if not present

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

// ===================== AUTH GUARD FOR OTHER PAGES =====================

function requireAuth(pageInitFn) {
  auth.onAuthStateChanged((user) => {
    console.log("Auth state on protected page:", user ? user.uid : "no user");
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    // Save basic info
    localStorage.setItem("sb_user_uid", user.uid);
    localStorage.setItem("sb_user_email", user.email);

    pageInitFn(user);
  });
}

// ===================== SIGNUP & LOGIN =====================

async function handleSignup(e) {
  e.preventDefault();
  console.log("Signup submit fired");

  const name = $("#signup-name")?.value.trim();
  const email = $("#signup-email")?.value.trim();
  const pass = $("#signup-password")?.value.trim();
  const role = document.querySelector('input[name="signup-role"]:checked')?.value;

  if (!name || !email || !pass || !role) {
    showToast("Fill all fields & pick role.", "error");
    alert("Fill all fields & pick role.");
    return;
  }

  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address.", "error");
    alert("Use a valid @gmail.com address.");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    console.log("Signup success UID:", cred.user.uid);

    // Try to store user role/info (if rules allow)
    try {
      await db.collection("users").doc(cred.user.uid).set({
        name,
        email,
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (fireErr) {
      console.warn("Could not write user doc (rules maybe?):", fireErr);
    }

    await sendWelcomeEmail(email, name);
    showToast("Signup successful!", "success");
    alert("Signup successful! Redirecting as " + role);

    // HARD redirect based on chosen role
    if (role === "seller") {
      window.location.href = "seller.html";
    } else {
      window.location.href = "customer.html";
    }
  } catch (err) {
    console.error("Signup error:", err);
    showToast(err.message, "error");
    alert("Signup failed: " + err.message);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  console.log("Login submit fired");

  const email = $("#login-email")?.value.trim();
  const pass = $("#login-password")?.value.trim();

  if (!email || !pass) {
    showToast("Enter email & password.", "error");
    alert("Enter email & password.");
    return;
  }
  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address.", "error");
    alert("Use a valid @gmail.com address.");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    console.log("Login success UID:", cred.user.uid);

    // Try to fetch role, but don't depend on it
    let role = "customer";
    try {
      const docSnap = await db.collection("users").doc(cred.user.uid).get();
      const data = docSnap.data();
      if (data && data.role) role = data.role;
    } catch (fireErr) {
      console.warn("Could not read user doc:", fireErr);
    }

    showToast("Logged in!", "success");
    alert("Login success! Redirecting as " + role);

    if (role === "seller") {
      window.location.href = "seller.html";
    } else {
      window.location.href = "customer.html";
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast(err.message, "error");
    alert("Login failed: " + err.message);
  }
}

function handleLogout() {
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = "index.html";
  });
}

// ===================== SELLER PAGE =====================

function initSellerPage(user) {
  console.log("Init seller page for:", user.email);
  const productForm = $("#product-form");
  const productsContainer = $("#seller-products");
  const emailSpan = $("#user-email-display");
  const logoutBtn = $("#logout-btn");

  if (emailSpan) emailSpan.textContent = user.email;
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("#prod-title").value.trim();
      const price = parseFloat($("#prod-price").value);
      const desc = $("#prod-desc").value.trim();
      const imageUrl = $("#prod-image").value.trim();

      if (!title || !price || !desc) {
        showToast("Fill all product details.", "error");
        return;
      }

      try {
        await db.collection("products").add({
          title,
          price,
          desc,
          imageUrl: imageUrl || "https://via.placeholder.com/300x200?text=Stationery",
          ownerId: user.uid,
          published: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("Product saved as draft.", "success");
        productForm.reset();
      } catch (err) {
        console.error(err);
        showToast("Error saving product.", "error");
      }
    });
  }

  if (productsContainer) {
    db.collection("products")
      .where("ownerId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        productsContainer.innerHTML = "";
        snap.forEach((doc) => {
          const p = doc.data();
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
                <button class="btn btn-small toggle-publish" data-id="${doc.id}">
                  ${p.published ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
          `;
          productsContainer.appendChild(card);
        });

        $all(".toggle-publish").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const ref = db.collection("products").doc(id);
            const snapNow = await ref.get();
            const current = snapNow.data().published;
            await ref.update({ published: !current });
            showToast(!current ? "Product published!" : "Product hidden.", "success");
          });
        });
      });
  }
}

// ===================== CUSTOMER PAGE =====================

function initCustomerPage(user) {
  console.log("Init customer page for:", user.email);
  const emailSpan = $("#user-email-display");
  const logoutBtn = $("#logout-btn");
  const cartBtn = $("#go-cart-btn");
  const list = $("#product-list");

  if (emailSpan) emailSpan.textContent = user.email;
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (cartBtn) cartBtn.addEventListener("click", () => {
    window.location.href = "cart.html";
  });

  if (list) {
    db.collection("products")
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        list.innerHTML = "";
        if (snap.empty) {
          list.innerHTML = `<p class="muted">No stationery items yet. Sellers will add soon.</p>`;
          return;
        }

        snap.forEach((doc) => {
          const p = doc.data();
          const card = document.createElement("div");
          card.className = "card product-card";
          card.innerHTML = `
            <img src="${p.imageUrl}" alt="${p.title}">
            <div class="card-content">
              <h3>${p.title}</h3>
              <p class="muted">${p.desc}</p>
              <div class="card-footer">
                <span class="price">$${p.price.toFixed(2)}</span>
                <button class="btn btn-small add-to-cart" data-id="${doc.id}">
                  Add to cart
                </button>
              </div>
            </div>
          `;
          list.appendChild(card);
        });

        $all(".add-to-cart").forEach((btn) => {
          btn.addEventListener("click", () => addToCart(user.uid, btn.dataset.id));
        });
      });
  }
}

async function addToCart(userId, productId) {
  try {
    const cartRef = db.collection("carts").doc(userId);
    const snap = await cartRef.get();
    let items = [];
    if (snap.exists) items = snap.data().items || [];

    const idx = items.findIndex((i) => i.productId === productId);
    if (idx >= 0) {
      items[idx].qty += 1;
    } else {
      items.push({ productId, qty: 1 });
    }
    await cartRef.set({ userId, items });
    showToast("Added to cart.", "success");
  } catch (err) {
    console.error(err);
    showToast("Cart update failed.", "error");
  }
}

// ===================== CART PAGE =====================

function initCartPage(user) {
  console.log("Init cart page for:", user.email);
  const emailSpan = $("#user-email-display");
  const logoutBtn = $("#logout-btn");
  const container = $("#cart-items");
  const totalEl = $("#cart-total");
  const checkoutBtn = $("#checkout-btn");

  if (emailSpan) emailSpan.textContent = user.email;
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const cartRef = db.collection("carts").doc(user.uid);
  cartRef.onSnapshot(async (snap) => {
    if (!container || !totalEl) return;

    container.innerHTML = "";
    if (!snap.exists || !snap.data().items.length) {
      container.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      totalEl.textContent = "$0.00";
      return;
    }

    const items = snap.data().items;
    let total = 0;
    for (const item of items) {
      const prodSnap = await db.collection("products").doc(item.productId).get();
      if (!prodSnap.exists) continue;
      const p = prodSnap.data();
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
            <button class="qty-btn" data-id="${item.productId}" data-action="dec">−</button>
            <button class="qty-btn" data-id="${item.productId}" data-action="inc">+</button>
          </div>
        </div>
      `;
      container.appendChild(row);
    }
    totalEl.textContent = `$${total.toFixed(2)}`;

    $all(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const snapNow = await cartRef.get();
        if (!snapNow.exists) return;
        let itemsNow = snapNow.data().items || [];
        const idx = itemsNow.findIndex((i) => i.productId === id);
        if (idx === -1) return;
        if (action === "inc") {
          itemsNow[idx].qty += 1;
        } else {
          itemsNow[idx].qty -= 1;
          if (itemsNow[idx].qty <= 0) itemsNow.splice(idx, 1);
        }
        await cartRef.set({ userId: user.uid, items: itemsNow });
      });
    });
  });

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      showToast("Order placed! (Demo checkout)", "success");
    });
  }
}

// ===================== PAGE INITIALISATION =====================

function initLoginPage() {
  console.log("Init login page");
  const signupForm = $("#signup-form");
  const loginForm = $("#login-form");

  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
    console.log("Signup listener attached");
  }
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
    console.log("Login listener attached");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  console.log("DOM ready, page =", page);

  if (page === "login") {
    initLoginPage();
    // NO auth.onAuthStateChanged here; we only redirect AFTER manual login/signup
    return;
  }

  if (page === "customer") {
    requireAuth(initCustomerPage);
  } else if (page === "seller") {
    requireAuth(initSellerPage);
  } else if (page === "cart") {
    requireAuth(initCartPage);
  }
});
