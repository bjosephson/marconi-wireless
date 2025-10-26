// Authentication Module
// This handles all the login/logout stuff so the game code stays simple!

// Supabase Configuration
const SUPABASE_URL = "https://afswezwmfjsgupgdcybl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmc3dlendtZmpzZ3VwZ2RjeWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDQxNzUsImV4cCI6MjA3NjkyMDE3NX0.94PzWGpJzy3WsMD55brMJPMgSWQUhI_m-RldY_xiVLk";

// Initialize Supabase client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export the Supabase client so the game can use it
window.getSupabaseClient = () => _supabase;

// Current user info
let currentUser = null;

// Get current user
window.getCurrentUser = () => currentUser;

// DOM Elements for authentication
const emailInput = document.getElementById("email");
const sendLinkBtn = document.getElementById("sendLink");
const authStatus = document.getElementById("authStatus");
const authDiv = document.getElementById("auth");
const appDiv = document.getElementById("app");
const userEmailSpan = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOut");

// Send magic link for authentication
sendLinkBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
        alert("Please enter an email address");
        return;
    }
    
    sendLinkBtn.disabled = true;
    sendLinkBtn.textContent = "Sending...";
    
    const { error } = await _supabase.auth.signInWithOtp({ 
        email,
        options: {
            emailRedirectTo: window.location.origin + window.location.pathname
        }
    });
    
    sendLinkBtn.disabled = false;
    sendLinkBtn.textContent = "Send magic link";
    
    if (error) {
        alert("Failed to send magic link: " + error.message);
        console.error(error);
        authStatus.textContent = "Error sending magic link";
        return;
    }
    
    authStatus.textContent = "✓ Magic link sent — check your email";
});

// Sign out handler
signOutBtn.addEventListener("click", async () => {
    await _supabase.auth.signOut();
    updateUI(null);
});

// Update UI based on authentication state
function updateUI(session) {
    if (session?.user) {
        currentUser = session.user;
        authStatus.textContent = "✓ Signed in";
        userEmailSpan.textContent = session.user.email || "unknown";
        authDiv.style.display = "none";
        appDiv.style.display = "block";
        
        // Notify the game that user is logged in
        if (window.onUserAuthenticated) {
            window.onUserAuthenticated(session.user);
        }
    } else {
        currentUser = null;
        authStatus.textContent = "Not signed in";
        authDiv.style.display = "block";
        appDiv.style.display = "none";
        
        // Notify the game that user logged out
        if (window.onUserSignedOut) {
            window.onUserSignedOut();
        }
    }
}

// Initialize authentication
async function initAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    _supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth event:", event);
        updateUI(session);
    });
    updateUI(session);
}

// Start authentication when page loads
initAuth();
