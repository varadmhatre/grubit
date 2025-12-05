// app.js

// ===================== FIREBASE INIT =====================
// 1) Make sure you have added the Firebase CDN scripts in EACH HTML BEFORE this file.
// 2) Replace the placeholder values below with the config from Firebase console.

const firebaseConfig = {
  apiKey: "AIzaSyCR01N7CSB7OfB8VxHzkV725Zeo7ct-ibA",
  authDomain: "grubit-45d09.firebaseapp.com",
  projectId: "grubit-45d09",
  storageBucket: "grubit-45d09.firebasestorage.app",
  messagingSenderId: "787109161650",
  appId: "1:787109161650:web:bb9a0f8f321f8a75bb77ab"
};

if (typeof firebase === "undefined") {
  console.error("Firebase SDK not loaded. Check your script tags in HTML.");
}

const appFirebase = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

// Simple Gmail check
function isValidGmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  return regex.test(email);
}

// ===================== EMAILJS (SIGNUP THANK-YOU) =====================

// On index.html we call: emailjs.init("YOUR_PUBLIC_KEY");
// Here we just use it if present.
async function sendWelcomeEmail(email, name) {
  if (!window.emailjs) return;
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

// ===================== AUTH GUARD =====================

function requireAuth(redirectIfNo = "index.html") {
  auth.onAuthStateChanged((user) => {
    const currentPage = document.body.dataset.page;

    if (!user) {
      if (currentPage !== "login") {
        window.location.href = redirectIfNo;
      }
      return;
    }

    localStorage.setItem("sb_user_uid", user.uid);
    localStorage.setItem("sb_user_email", user.email);

    if (currentPage === "customer") {
      initCustomerPage(user);
    } else if (currentPage === "seller") {
      initSellerPage(user);
    } else if (currentPage === "cart") {
      initCartPage(user);
    }
  });
}

// ===================== SIGNUP / LOGIN =====================

async function handleSignup(e) {
  e.preventDefault();
  const name = $("#signup-name").value.trim();
  const email = $("#signup-email").value.trim();
  const pass = $("#signup-password").value.trim();
  const role = document.querySelector('input[name="signup-role"]:checked')?.value;

  if (!name || !email || !pass || !role) {
    showToast("Please fill all fields & select role.", "error");
    return;
  }

  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address.", "error");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);

    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await sendWelcomeEmail(email, name);
    showToast("Signup successful. Welcome!", "success");

    if (role === "seller") {
      window.location.href = "seller.html";
    } else {
      window.location.href = "customer.html";
    }
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  console.log("Login submit fired");

  const email = $("#login-email").value.trim();
  const pass = $("#login-password").value.trim();

  if (!email || !pass) {
    showToast("Enter email & password.", "error");
    alert("Enter email & password.");
    return;
  }
  if (!isValidGmail(email)) {
    showToast("Use a valid @gmail.com address (@gmail.com only).", "error");
    alert("Use a valid @gmail.com address.");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    console.log("Firebase login success:", cred.user.uid);

    const userDoc = await db.collection("users").doc(cred.user.uid).get();
    const data = userDoc.data() || {};
    const role = data.role || "customer";

    alert("Login success! Role: " + role);
    showToast("Logged in successfully!", "success");

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
  const productForm = $("#product-form");
  const productsContainer = $("#seller-products");

  $("#user-email-display").textContent = user.email;

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
          const snap = await ref.get();
          const current = snap.data().published;
          await ref.update({ published: !current });
          showToast(!current ? "Product published!" : "Product hidden.", "success");
        });
      });
    });

  $("#logout-btn").addEventListener("click", handleLogout);
}

// ===================== CUSTOMER PAGE =====================

function initCustomerPage(user) {
  $("#user-email-display").textContent = user.email;
  const list = $("#product-list");

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

  $("#go-cart-btn").addEventListener("click", () => {
    window.location.href = "cart.html";
  });
  $("#logout-btn").addEventListener("click", handleLogout);
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
  $("#user-email-display").textContent = user.email;
  const container = $("#cart-items");
  const totalEl = $("#cart-total");

  const cartRef = db.collection("carts").doc(user.uid);
  cartRef.onSnapshot(async (snap) => {
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

  $("#checkout-btn").addEventListener("click", async () => {
    showToast("Order placed! (Dummy checkout)", "success");
  });
  $("#logout-btn").addEventListener("click", handleLogout);
}

// ===================== PAGE BOOTSTRAP =====================

// ===================== PAGE BOOTSTRAP =====================
(function initPage() {
  const page = document.body.dataset.page;
  console.log("Init page:", page);

  if (page === "login") {
    const signupForm = $("#signup-form");
    const loginForm = $("#login-form");

    if (signupForm) {
      signupForm.addEventListener("submit", handleSignup);
      console.log("Signup form listener attached");
    }

    if (loginForm) {
      loginForm.addEventListener("submit", handleLogin);
      console.log("Login form listener attached");
    }

    // If user already logged in and somehow opens index.html again → send to home
    auth.onAuthStateChanged(async (user) => {
      console.log("Auth state on login page:", user ? user.uid : "no user");
      if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        const data = doc.data() || {};
        const role = data.role || "customer";
        if (role === "seller") window.location.href = "seller.html";
        else window.location.href = "customer.html";
      }
    });
  } else {
    // Any page that isn't login must be protected
    requireAuth();
  }
})();


console.log("Firebase App:", firebase.app().name);
console.log("Auth:", auth);
console.log("DB:", db);

   
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
        
const auth = getAuth();
    
function signupUser(email, password) {
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed up successfully
                const user = userCredential.user;
                console.log("User signed up:", user);
                // Redirect or update UI
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Signup error:", errorCode, errorMessage);
                // Display error to the user
            });
    }









