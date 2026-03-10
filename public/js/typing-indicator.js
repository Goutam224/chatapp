// WhatsApp-style typing indicator (chat screen + chat list)

let typingAnimationInterval = null;
let typingTimeout = null;
let typingDots = 0;

// CHAT SCREEN typing animation
window.startTypingIndicator = function(){

    const typingDiv = document.getElementById('typing-indicator');

    if(!typingDiv) return;

    clearInterval(typingAnimationInterval);

    typingAnimationInterval = setInterval(() => {

        typingDots = (typingDots + 1) % 4;

        typingDiv.innerText = "typing" + ".".repeat(typingDots);

        typingDiv.style.color = "#25D366";

    }, 400);

};

window.stopTypingIndicator = function(){

    const typingDiv = document.getElementById('typing-indicator');

    if(typingDiv) typingDiv.innerText = "";

    clearInterval(typingAnimationInterval);

};

window.showSidebarTyping = function(chatId){

    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if(!chatItem) return;

    const lastMsg = chatItem.querySelector('.chat-last');
    if(!lastMsg) return;

    // save original message only once
    if(!chatItem.dataset.originalMessage){
        chatItem.dataset.originalMessage = lastMsg.innerText;
    }

    // clear existing animation
    clearInterval(chatItem.typingInterval);

    // ✅ show typing immediately (prevents flicker)
    let dots = 0;
    lastMsg.innerText = "typing";
    lastMsg.style.color = "#25D366"; 

    chatItem.typingInterval = setInterval(() => {

        dots = (dots + 1) % 4;
        lastMsg.innerText = "typing" + ".".repeat(dots);

    }, 400);

};


window.hideSidebarTyping = function(chatId){

    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

    if(!chatItem) return;

    const lastMsg = chatItem.querySelector('.chat-last');

    if(!lastMsg) return;

    clearInterval(chatItem.typingInterval);

    // restore original message safely
    if(chatItem.dataset.originalMessage){
        lastMsg.innerText = chatItem.dataset.originalMessage;
    }

    lastMsg.style.color = "";

};



// MAIN handler
window.handleTypingEvent = function(userId, chatId){

    if(userId == window.AUTH_USER_ID) return;

    const statusEl = document.getElementById('chat-status');

    // Only handle header typing if chat is open
    if(statusEl){

        if(!statusEl.dataset.originalStatus){
            statusEl.dataset.originalStatus = statusEl.innerText;
        }

        statusEl.innerText = "typing...";
        statusEl.style.color = "#25D366";

        startTypingIndicator();

        clearTimeout(typingTimeout);

        typingTimeout = setTimeout(() => {

            stopTypingIndicator();

            statusEl.innerText = statusEl.dataset.originalStatus || "";
            statusEl.style.color =
                statusEl.innerText === "online" ? "#25D366" : "#8696a0";

            delete statusEl.dataset.originalStatus;

        }, 1500);

    }

    // ✅ ALWAYS show sidebar typing
    showSidebarTyping(chatId);

    clearTimeout(window.sidebarTypingTimeout);

    window.sidebarTypingTimeout = setTimeout(() => {
        hideSidebarTyping(chatId);
    }, 1500);

};
