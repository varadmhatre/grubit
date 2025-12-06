// ===================== FIREBASE INIT (AUTH + FIRESTORE) =====================

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

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// ===================== HELPERS =====================

function $(s){ return document.querySelector(s); }

function toast(msg){
  alert(msg);
}

function isValidGmail(email){
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

// ===================== AUTH =====================

async function handleSignup(e){
  e.preventDefault();

  const name  = $("#signup-name").value.trim();
  const email = $("#signup-email").value.trim().toLowerCase();
  const pass  = $("#signup-password").value.trim();
  const role  = document.querySelector('input[name="signup-role"]:checked')?.value;

  if(!name || !email || !pass || !role){
    toast("Fill all fields & choose role");
    return;
  }

  if(!isValidGmail(email)){
    toast("Only Gmail addresses allowed");
    return;
  }

  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);

    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if(role === "seller"){
      window.location = "seller.html";
    }else{
      window.location = "customer.html";
    }
  }
  catch(err){
    console.error(err);
    toast(err.message);
  }
}

async function handleLogin(e){
  e.preventDefault();

  const email = $("#login-email").value.trim().toLowerCase();
  const pass  = $("#login-password").value.trim();

  try{
    const cred = await auth.signInWithEmailAndPassword(email, pass);

    const doc = await db.collection("users").doc(cred.user.uid).get();
    const role = doc.exists ? doc.data().role : "customer";

    if(role === "seller"){
      window.location = "seller.html";
    }else{
      window.location = "customer.html";
    }
  }
  catch(err){
    console.error(err);
    toast(err.message);
  }
}

function handleLogout(){
  auth.signOut().then(()=>{
    window.location = "index.html";
  });
}

// ===================== PROTECT PAGES =====================

function requireAuth(callback){
  auth.onAuthStateChanged(user=>{
    if(!user){
      window.location = "index.html";
      return;
    }
    callback(user);
  });
}

// ===================== INIT BY PAGE =====================

document.addEventListener("DOMContentLoaded", ()=>{

  const page = document.body.dataset.page;

  // LOGIN PAGE
  if(page === "login"){
    $("#signup-form")?.addEventListener("submit", handleSignup);
    $("#login-form")?.addEventListener("submit", handleLogin);
    return;
  }

  // SELLER PAGE
  if(page === "seller"){
    requireAuth((user)=>{

      $("#logout-btn")?.addEventListener("click", handleLogout);

    });
  }

  // CUSTOMER PAGE
  if(page === "customer"){
    requireAuth((user)=>{

      $("#logout-btn")?.addEventListener("click", handleLogout);

      $("#go-cart-btn")?.addEventListener("click", ()=>{
        window.location.href = "cart.html";
      });

    });
  }

  // CART PAGE
  if(page === "cart"){
    requireAuth((user)=>{

      $("#logout-btn")?.addEventListener("click", handleLogout);

    });
  }

});




  // PROTECTED ROUTES
  if(page === "seller"){
    requireAuth(()=>{});
  }

  if(page === "customer"){
    requireAuth(()=>{});
  }

  if(page === "cart"){
    requireAuth(()=>{});
  }

});

