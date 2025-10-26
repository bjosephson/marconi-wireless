// ========================================
// MARCONI WIRELESS TELEGRAPH GAME
// ========================================
// This is the main game code that handles Morse code messages!
// All the login stuff is in auth.js so we can focus on the fun parts here.

// Get the Supabase client from the auth module
const _supabase = window._supabase;

// Morse code dictionary - this is how we convert letters to dots and dashes!
const morseCode = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', ' ': '/'
};

// Audio context for generating beeps (lazy-initialized on first use)
let audioContext = null;

// Initialize audio context on first user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio context initialized");
    }
    return audioContext;
}

// Global variables for the game
let channel = null;

// DOM Elements - these are the parts of the page we control
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("send");
const messagesContainer = document.getElementById("messagesContainer");
const statusDiv = document.getElementById("status");

// Convert text to Morse code
function textToMorse(text) {
    return text.toUpperCase().split('').map(char => {
        return morseCode[char] || '';
    }).join(' ');
}

// Play Morse code sound
async function playMorse(morse) {
    try {
        // Initialize audio context if needed
        const ctx = initAudioContext();
        
        // Resume audio context if it's suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        
        const ditDuration = 80; // milliseconds for a dit
        const dahDuration = ditDuration * 3;
        const symbolGap = ditDuration;
        const letterGap = ditDuration * 3;
        const wordGap = ditDuration * 7;
        
        for (let i = 0; i < morse.length; i++) {
            const symbol = morse[i];
            
            if (symbol === '.') {
                await playBeep(600, ditDuration);
                await sleep(symbolGap);
            } else if (symbol === '-') {
                await playBeep(600, dahDuration);
                await sleep(symbolGap);
            } else if (symbol === ' ') {
                await sleep(letterGap);
            } else if (symbol === '/') {
                await sleep(wordGap);
            }
        }
    } catch (error) {
        console.error("Error playing Morse code:", error);
    }
}

// Generate a beep sound
function playBeep(frequency, duration) {
    return new Promise(resolve => {
        try {
            const ctx = initAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
            
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration / 1000);
            
            setTimeout(resolve, duration);
        } catch (error) {
            console.error("Error in playBeep:", error);
            setTimeout(resolve, duration);
        }
    });
}

// Sleep function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Display a message
function displayMessage(row, playSound = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Extract data from row - handle both database fetch and realtime payloads
    // row.payload is the JSONB column containing message data
    const payloadData = row.payload || {};
    const username = row.username || payloadData.username || 'Anonymous';
    const text = payloadData.message || '';
    const morse = payloadData.morse || textToMorse(text);
    const timestamp = new Date(row.created_at || payloadData.sent_at).toLocaleTimeString();
    
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    
    messageDiv.innerHTML = `
        <div class="message-username">📡 ${escapeHtml(username)}</div>
        <div class="message-text">${escapeHtml(text)}</div>
        <div class="message-morse">${morse}</div>
        <div class="message-time">Transmitted at ${timestamp}</div>
    `;
    
    messagesContainer.insertBefore(messageDiv, messagesContainer.firstChild);
    
    if (playSound && morse) {
        playMorse(morse);
    }
}

// Fetch recent messages from Supabase
async function fetchRecentMessages(limit = 50) {
    const room = "global";
    const { data, error } = await _supabase
        .from("morse_messages")
        .select("*")
        .eq("room", room)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Error fetching messages:", error);
        statusDiv.textContent = "⚠ Error loading messages";
        return;
    }
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    // Show in chronological order (oldest first)
    (data || []).reverse().forEach(row => displayMessage(row, false));
    
    // Don't overwrite the realtime connection status if it's already set
    if (!statusDiv.classList.contains('connected')) {
        statusDiv.textContent = "Loading historical transmissions...";
    }
}

// Subscribe to realtime updates
function startRealtime() {
    if (channel) return;
    
    // Create a channel without private config - not needed for postgres_changes
    channel = _supabase.channel("morse:global");

    // Listen for INSERT events on morse_messages table
    channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "morse_messages" },
        (payload) => {
            console.log("New message received:", payload);
            if (payload.new) {
                displayMessage(payload.new, true);
            }
        }
    );

    channel.subscribe((status) => {
        console.log("Channel status:", status);
        if (status === "SUBSCRIBED") {
            statusDiv.textContent = "ANTENNA ACTIVE - Receiving all broadcasts";
            statusDiv.className = "status connected";
        } else if (status === "CHANNEL_ERROR") {
            statusDiv.textContent = "⚠ Connection error - check console";
            statusDiv.className = "status error";
            console.error("Realtime channel error");
        } else if (status === "TIMED_OUT") {
            statusDiv.textContent = "⚠ Connection timed out - retrying...";
            statusDiv.className = "status error";
        } else if (status === "CLOSED") {
            statusDiv.textContent = "Antenna disconnected";
            statusDiv.className = "status";
        }
    });
}

// Stop realtime subscription
function stopRealtime() {
    if (!channel) return;
    _supabase.removeChannel(channel);
    channel = null;
}

// Send a message
async function transmitMessage() {
    const text = messageInput.value.trim();
    
    if (!text) {
        alert('Please enter a message to transmit!');
        return;
    }
    
    // Initialize audio context on user interaction (required by browsers)
    initAudioContext();
    
    const currentUser = window.getCurrentUser();
    const username = usernameInput.value.trim() || currentUser?.email || "Anonymous";
    const room = "global";
    const morse = textToMorse(text);
    
    const payload = {
        username,
        message: text,
        morse: morse,
        encoding: "morse",
        sent_at: new Date().toISOString()
    };

    const { data: { user } } = await _supabase.auth.getUser();
    const user_id = user?.id ?? null;

    sendBtn.disabled = true;
    sendBtn.textContent = "TRANSMITTING...";

    const { error } = await _supabase.from("morse_messages").insert([{
        room,
        username,
        payload,
        user_id
    }]);

    sendBtn.disabled = false;
    sendBtn.textContent = "SEND TRANSMISSION";

    if (error) {
        alert("Failed to send message: " + error.message);
        console.error("Error sending message:", error);
        statusDiv.textContent = "⚠ Transmission failed";
        return;
    }

    messageInput.value = "";
    console.log("Message transmitted successfully");
}

// ========================================
// CALLBACKS FOR AUTHENTICATION
// ========================================
// The auth.js module will call these functions when someone logs in or out

// When someone logs in, start the game!
window.onUserAuthenticated = function(user) {
    console.log("User logged in, starting game!");
    startRealtime();
    fetchRecentMessages();
};

// When someone logs out, stop the game
window.onUserSignedOut = function() {
    console.log("User logged out, stopping game");
    stopRealtime();
    messagesContainer.innerHTML = '';
};

// Send button click handler
sendBtn.addEventListener("click", transmitMessage);

// Allow Enter to send (Shift+Enter for new line)
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        transmitMessage();
    }
});
