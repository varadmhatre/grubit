// ===================== FIREBASE INIT (AUTH + FIRESTORE) =====================
// Replace this config with your Firebase project's Web config
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
  console.error("Firebase SDK not loaded. Check script tags in HTML.");
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
// You must have emailjs loaded in index.html and emailjs.init("PUBLIC_KEY") called there.

async function sendWelcomeEmail(email, name) {
  if (!window.emailjs) return; // if not loaded, just skip

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

// ===================== AUTH HELPERS =====================

async function handleSignup(e) {
  e.preventDefault();
  const name  = $("#signup-name")?.value.trim();
  const email = $("#signup-email")?.value.trim().toLowerCase();
  const pass  = $("#signup-password")?.value.trim();
  const role  = document.querySelector('input[name="signup-role"]:checked')?.value;

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

    // Save user profile + role in Firestore
    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Welcome email
    await sendWelcomeEmail(email, name);

    // Cache some info locally
    localStorage.setItem("sb_user_uid", cred.user.uid);
    localStorage.setItem("sb_user_email", cred.user.email);

    showToast("Signup successful!", "success");

    // Redirect based on role
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
  const email = $("#login-email")?.value.trim().toLowerCase();
  const pass  = $("#login-password")?.value.trim();

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

    // Fetch role from Firestore
    let role = "customer";
    try {
      const doc = await db.collection("users").doc(cred.user.uid).get();
      if (doc.exists && doc.data().role) {
        role = doc.data().role;
      }
    } catch (e2) {
      console.warn("Could not read user role:", e2);
    }

    localStorage.setItem("sb_user_uid", cred.user.uid);
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
    window.location.href = "index.html";
  });
}

// For protected pages
function requireAuth(pageInitFn) {
  auth.onAuthStateChanged(async (user) => {
    const currentPage = document.body.dataset.page;
    if (!user) {
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

// ===================== SELLER PAGE (PRODUCTS IN FIRESTORE) =====================

function initSellerPage(user) {
  console.log("Seller page for:", user.email);

  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const form = $("#product-form");
  const list = $("#seller-products");

  // Add new product (draft)
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("#prod-title").value.trim();
      const price = parseFloat($("#prod-price").value);
      const desc  = $("#prod-desc").value.trim();
      const imageUrl = $("#prod-image").value.trim();

      if (!title || !price || !desc) {
        showToast("Fill all product fields.", "error");
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
        form.reset();
      } catch (err) {
        console.error("Product create error:", err);
        showToast("Error saving product.", "error");
      }
    });
  }

  // Live sync seller's products
  if (list) {
    db.collection("products")
      .where("ownerId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snap) => {
          list.innerHTML = "";
          if (snap.empty) {
            list.innerHTML = `<p class="muted">You haven't added any products yet.</p>`;
            return;
          }

          snap.forEach((doc) => {
            const p = doc.data();
            const id = doc.id;

            const card = document.createElement("div");
            card.className = "card product-card";
            card.innerHTML = `
              <img src="${p.imageUrl}" alt="${p.title}">
              <div class="card-content">
                <h3>${p.title}</h3>
                <p class="muted">${p.desc}</p>
                <p class="price">$${Number(p.price).toFixed(2)}</p>
                <div class="product-actions">
                  <span class="status-pill ${p.published ? "published" : "draft"}">
                    ${p.published ? "Published" : "Draft"}
                  </span>
                  <button class="btn btn-small toggle-publish" data-id="${id}">
                    ${p.published ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </div>
            `;
            list.appendChild(card);
          });

          $all(".toggle-publish").forEach((btn) => {
            btn.onclick = async () => {
              const id = btn.dataset.id;
              const ref = db.collection("products").doc(id);
              const snapNow = await ref.get();
              if (!snapNow.exists) return;
              const current = !!snapNow.data().published;
              await ref.update({ published: !current });
              showToast(!current ? "Product published!" : "Product hidden.", "success");
            };
          });
        },
        (error) => {
          console.error("SELLER SNAPSHOT ERROR:", error);
          showToast("Error loading your products.", "error");
        }
      );
  }
}

// ===================== CUSTOMER PAGE (GLOBAL PRODUCTS) =====================

function initCustomerPage(user) {
  console.log("Customer page for:", user.email);

  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const cartBtn = $("#go-cart-btn");
  if (cartBtn) cartBtn.addEventListener("click", () => {
    window.location.href = "cart.html";
  });

  const list = $("#product-list");

  if (list) {
    db.collection("products")
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snap) => {
          list.innerHTML = "";
          if (snap.empty) {
            list.innerHTML = `<p class="muted">No stationery items available yet.</p>`;
            return;
          }

          snap.forEach((doc) => {
            const p = doc.data();
            const id = doc.id;

            const card = document.createElement("div");
            card.className = "card product-card";
            card.innerHTML = `
              <img src="${p.imageUrl}" alt="${p.title}">
              <div class="card-content">
                <h3>${p.title}</h3>
                <p class="muted">${p.desc}</p>
                <div class="card-footer">
                  <span class="price">$${Number(p.price).toFixed(2)}</span>
                  <button class="btn btn-small add-to-cart" data-id="${id}">
                    Add to cart
                  </button>
                </div>
              </div>
            `;
            list.appendChild(card);
          });

          $all(".add-to-cart").forEach((btn) => {
            btn.onclick = () => addToCart(user.uid, btn.dataset.id);
          });
        },
        (error) => {
          console.error("CUSTOMER SNAPSHOT ERROR:", error);
          showToast("Error loading products.", "error");
        }
      );
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
    console.error("Add to cart error:", err);
    showToast("Error updating cart.", "error");
  }
}

// ===================== CART PAGE =====================

function initCartPage(user) {
  console.log("Cart page for:", user.email);

  const emailSpan = $("#user-email-display");
  if (emailSpan) emailSpan.textContent = user.email;

  const logoutBtn = $("#logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const container = $("#cart-items");
  const totalEl   = $("#cart-total");
  const checkoutBtn = $("#checkout-btn");

  const cartRef = db.collection("carts").doc(user.uid);

  cartRef.onSnapshot(
    async (snap) => {
      if (!container || !totalEl) return;

      container.innerHTML = "";
      if (!snap.exists || !snap.data().items || !snap.data().items.length) {
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
        const lineTotal = Number(p.price) * item.qty;
        total += lineTotal;

        const row = document.createElement("div");
        row.className = "cart-row";
        row.innerHTML = `
          <div class="cart-info">
            <h4>${p.title}</h4>
            <p class="muted">$${Number(p.price).toFixed(2)} × ${item.qty}</p>
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
        btn.onclick = async () => {
          const action = btn.dataset.action;
          const id     = btn.dataset.id;

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
        };
      });
    },
    (error) => {
      console.error("CART SNAPSHOT ERROR:", error);
      showToast("Error loading cart.", "error");
    }
  );

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
      showToast("Order placed! (demo checkout)", "success");
      await cartRef.set({ userId: user.uid, items: [] });
    });
  }
}

// ===================== PAGE BOOTSTRAP =====================

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  console.log("Init page:", page);

  if (page === "login") {
    const signupForm = $("#signup-form");
    const loginForm  = $("#login-form";

    if (signupForm) signupForm.addEventListener("submit", handleSignup);
    if (loginForm)  loginForm.addEventListener("submit", handleLogin);

    // Optional: auto-redirect if user already logged in
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const doc = await db.collection("users").doc(user.uid).get();
        const role = doc.data()?.role || "customer";
        if (role === "seller") window.location.href = "seller.html";
        else window.location.href = "customer.html";
      } catch (err) {
        console.error("Auto-redirect error:", err);
      }
    });

    return;
  }

  // Protected pages:
  if (page === "seller") {
    requireAuth(initSellerPage);
  } else if (page === "customer") {
    requireAuth(initCustomerPage);
  } else if (page === "cart") {
    requireAuth(initCartPage);
  }
});
