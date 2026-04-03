// ✅ Chats API call — works for both session and token users
fetch('/chats', {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
    },
    credentials: 'same-origin' // ✅ sends session cookie automatically
})
.then(res => res.json())
.then(data => {
  
    window.chatsApiData = data; // ✅ available globally
})
.catch(err => {
    console.error('❌ Chats API Error:', err);
});


if(window.APP_PAGE !== "starred"){

window.currentChatId = null;

document.querySelectorAll('.chat-item')
.forEach(item => {

    const chatId = item.dataset.chatId;

    ChatSystem.listenSidebar(chatId, item);
joinPresenceChannel(chatId);
});


document.addEventListener('click', e => {

    const item = e.target.closest('.chat-item');
    if(!item) return;

    const chatId = item.dataset.chatId;

    const badge = item.querySelector('.unread-count');
    if(badge) badge.remove();

    // open chat only — do NOT reorder sidebar
    openChat(chatId, item);

});

document.addEventListener('DOMContentLoaded', function(){

    const newChatBtn = document.getElementById('new-chat-btn');
    if(!newChatBtn) return;

    newChatBtn.addEventListener('click', function(){

        const chatList = document.querySelector('.chat-list');
        const newChatList = document.getElementById('new-chat-list');

        chatList.style.display = 'none';
        newChatList.style.display = 'block';
        newChatList.innerHTML = '<div style="padding:15px;">Loading...</div>';

        fetch('/users')
        .then(res => res.json())
        .then(users => {

            newChatList.innerHTML = `
    <div class="new-chat-header">
        <span id="back-to-chats">←</span>
        <span>New Chat</span>
    </div>
    <div class="new-chat-users"></div>
`;
// ✅ ADD IT HERE
document.getElementById('back-to-chats')
.addEventListener('click', function(){

    document.getElementById('new-chat-list').style.display = 'none';
    document.querySelector('.chat-list').style.display = 'block';

});
const usersContainer = newChatList.querySelector('.new-chat-users');

            users.forEach(user => {

                const div = document.createElement('div');
                div.className = 'new-chat-user';
                div.innerHTML = `
                    <img src="${user.profile_photo ?? '/default.png'}" class="chat-img">
                    <div class="chat-info">
                        <div class="chat-name">${user.name}</div>
                    </div>
                `;

               div.addEventListener('click', function(e){
    e.stopPropagation();   // VERY IMPORTANT
    createOrOpenChat(user);
});

                usersContainer.appendChild(div);
            });

        });

    });

});
function createOrOpenChat(user)
{
    // Hide new-chat list, show main chat list
    document.getElementById('new-chat-list').style.display = 'none';
    document.querySelector('.chat-list').style.display = 'block';

    // Check if chat already exists in sidebar
    let existingItem = document.querySelector(`.chat-item[data-user-id="${user.id}"]`);

    if (existingItem) {
        // Real chat exists — open normally
        const chatId = existingItem.dataset.chatId;
        openChat(chatId, existingItem);
        return;
    }

    // No existing chat — open pending screen (WhatsApp style)
    openPendingChat(user);
}

function openPendingChat(user)
{
    // Set pending state — no chat ID yet
    window.pendingChatUser = user;
    window.currentChatId   = null;
    window.currentOtherUserId = user.id;

    const container = document.getElementById('chat-container');
    if (!container) return;

    // Remove active highlight from sidebar
    document.querySelectorAll('.chat-item.active')
        .forEach(el => el.classList.remove('active'));

    container.innerHTML = `
        <div class="chat-header" style="display:flex;align-items:center;gap:10px;padding:10px;">
            <button id="chat-back-btn"
                style="background:none;border:none;color:white;font-size:22px;cursor:pointer;padding:0 5px;">
                ←
            </button>
            <img src="${user.profile_photo ?? '/default.png'}"
                 onclick="ProfilePanel.open()"
                 style="width:40px;height:40px;border-radius:50%;cursor:pointer;">
            <div style="display:flex;flex-direction:column;">
                <span id="chat-user-name"
                      onclick="ProfilePanel.open()"
                      style="cursor:pointer;font-weight:500;"
                      data-user-id="${user.id}">
                    ${escapeHtml(user.name)}
                </span>
                <span id="chat-status" style="font-size:12px;color:#8696a0;"></span>
            </div>
        </div>

        <div id="pinned-bar" class="pinned-bar" style="display:none;"></div>

        <div id="chat-messages" class="chat-messages">
            <div class="msg-date">Today</div>
        </div>

        <button id="scroll-to-bottom" class="scroll-bottom-btn">
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            </svg>
        </button>

        <div id="typing-indicator" style="font-size:13px;color:#53bdeb;"></div>

        <div id="media-preview-bar" style="display:none;padding:10px;background:#111b21;border-top:1px solid #222;">
            <div id="media-preview-list" style="display:flex;gap:8px;overflow-x:auto;margin-bottom:8px;"></div>
            <input id="media-caption-input" placeholder="Add a caption..."
                   style="width:100%;padding:8px;background:#2a3942;border:none;color:white;border-radius:6px;outline:none;">
        </div>

        <div id="reply-preview"
             style="display:none;padding:8px 12px;background:#2a3942;border-left:4px solid #25D366;
                    align-items:center;justify-content:space-between;">
            <div style="display:flex;flex-direction:column;">
                <div id="reply-user" style="font-size:12px;color:#25D366;font-weight:500;"></div>
                <div id="reply-text"
                     style="font-size:13px;color:#d1d7db;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            </div>
            <button id="reply-cancel"
                    style="background:none;border:none;color:#8696a0;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div class="chat-input" style="display:flex;align-items:center;gap:10px;padding:10px;background:#202c33;">
            <input type="file" id="media-input" hidden multiple onchange="previewMedia(event)">
            <div style="position:relative;">
                <button onclick="toggleAttachMenu()" id="attach-button"
                        style="background:none;border:none;color:#8696a0;font-size:22px;cursor:pointer;">➕</button>
                <div id="attach-menu"
                     style="display:none;position:absolute;bottom:50px;left:0;background:#233138;
                            border-radius:12px;padding:8px 0;width:220px;
                            box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:999;">
                    ${renderAttachMenu()}
                </div>
            </div>
            <textarea id="message-input"
                placeholder="Type message"
                rows="1"
                style="flex:1;background:#2a3942;border:none;color:white;padding:10px;
                       border-radius:8px;outline:none;resize:none;max-height:120px;overflow-y:auto;"></textarea>
            <button onclick="handleSendAction()" id="send-button"
                    style="background:#25D366;border:none;width:40px;height:40px;border-radius:50%;
                           cursor:pointer;display:flex;align-items:center;justify-content:center;
                           transition:all 0.15s ease;padding:0;"
                    onmouseover="this.style.background='#20bd5a'"
                    onmouseout="this.style.background='#25D366'"
                    onmousedown="this.style.transform='scale(0.92)'"
                    onmouseup="this.style.transform='scale(1)'">
                <svg viewBox="0 0 24 24" width="18" height="18"
                     style="display:block;fill:white;margin-left:2px;">
                    <path d="M3.4,20.4L21.85,12L3.4,3.6v6.6l13.2,1.8l-13.2,1.8V20.4z"/>
                </svg>
            </button>
        </div>
    `;
// Back button → go back to dashboard
    document.getElementById('chat-back-btn').addEventListener('click', function () {
        window.pendingChatUser    = null;
        window.currentChatId      = null;
        window.currentOtherUserId = null;

        // Hide new-chat list, show main chat list
        document.getElementById('new-chat-list').style.display = 'none';
        document.querySelector('.chat-list').style.display = 'block';

        // Reset chat container to empty state
        const container = document.getElementById('chat-container');
        if (container) {
            container.innerHTML = `
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    height:100%;
                    font-size:20px;
                    color:#8696a0;
                ">
                    Select a chat to start messaging
                </div>
            `;
        }
    });

    // Load last seen / online status
    const isBlocked =
        (window.iBlockedUsers  && window.iBlockedUsers.includes(Number(user.id))) ||
        (window.blockedByUsers && window.blockedByUsers.includes(Number(user.id)));

    if (!isBlocked) {

        const headerStatus = document.getElementById('chat-status');

        // Read live members directly from global presence channel
        // (same logic as applyGlobalDotIfOnline — no sidebar item needed)
        const members = window.globalPresenceChannel
            && window.globalPresenceChannel.subscription
            && window.globalPresenceChannel.subscription.members
            && window.globalPresenceChannel.subscription.members.members;

        const isOnlineNow = members
            ? Object.values(members).some(u => Number(u.id) === Number(user.id))
            : false;

        // Also check sidebar dot as fallback (existing chat reopened as pending)
        const sidebarItem   = document.querySelector(`.chat-item[data-user-id="${user.id}"]`);
        const hasSidebarDot = sidebarItem && sidebarItem.querySelector('.online-dot');

        if ((isOnlineNow || hasSidebarDot) && headerStatus) {
            headerStatus.innerText = 'online';
            headerStatus.style.color = '#25D366';
        } else {
            $.ajax({
                url: '/user/last-seen/' + user.id,
                method: 'GET',
                success: function (response) {
                    const headerStatus = document.getElementById('chat-status');
                    if (!headerStatus) return;
                    if (headerStatus.innerText === 'online') return;
                    if (response.last_seen) {
                        headerStatus.innerText = 'last seen ' + response.last_seen;
                    } else {
                        headerStatus.innerText = '';
                    }
                }
            });
        }

        // Also hook into global presence joining/leaving so status
        // updates live while user is on the pending screen
        if (window.globalPresenceChannel) {
            window.globalPresenceChannel
                .joining((u) => {
                    if (Number(u.id) !== Number(user.id)) return;
                    if (window.pendingChatUser) {
                        const hs = document.getElementById('chat-status');
                        if (hs) { hs.innerText = 'online'; hs.style.color = '#25D366'; }
                    }
                })
                .leaving((u) => {
                    if (Number(u.id) !== Number(user.id)) return;
                    if (window.pendingChatUser) {
                        const hs = document.getElementById('chat-status');
                        if (hs) fetchLastSeen(user.id, hs);
                    }
                });
        }
    }

    // Scroll button
    const msgContainer = document.getElementById('chat-messages');
    const scrollBtn    = document.getElementById('scroll-to-bottom');
    if (msgContainer && scrollBtn) {
        msgContainer.addEventListener('scroll', function () {
            const isNearBottom =
                msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 100;
            scrollBtn.classList.toggle('show', !isNearBottom);
        });
        scrollBtn.onclick = function () {
            msgContainer.scrollTo({ top: msgContainer.scrollHeight, behavior: 'smooth' });
        };
    }
}

function formatSidebarTime(dateString) {

    if(!dateString) return '';

    const msgDate = new Date(dateString);
    const today = new Date();

    const msg = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffDays = Math.floor((now - msg) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const time = msgDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
});

return time.replace('am','AM').replace('pm','PM');
    }

    if (diffDays === 1) {
        return "Yesterday";
    }

    if (diffDays < 7) {
        return msgDate.toLocaleDateString(undefined, { weekday: 'long' });
    }

    return msgDate.toLocaleDateString('en-GB'); // dd/mm/yyyy
}

function refreshSidebarTime(el){

    const rawTime = el.dataset.time;
    const badge = el.querySelector('.unread-count');

    const formatted = formatSidebarTime(rawTime);

    el.innerHTML = formatted;

    if(badge){
        el.appendChild(badge);
    }

}

document.addEventListener('DOMContentLoaded', function(){

    document.querySelectorAll('.chat-time').forEach(el => {

        const rawTime = el.dataset.time;
        const badge = el.querySelector('.unread-count');

        const formatted = formatSidebarTime(rawTime);

        el.innerHTML = formatted;

        if(badge) {
            el.appendChild(badge);
        }

    });

});

}
