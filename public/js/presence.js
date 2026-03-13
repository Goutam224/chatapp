window.globalPresenceChannel = null;
window.chatPresenceChannels = {};
window.chatOnlineUsers = {};

/*
|--------------------------------------------------------------------------
| JOIN PRESENCE CHANNEL
|--------------------------------------------------------------------------
*/
window.joinPresenceChannel = function(chatId) {

    const chatItem = document.querySelector(
        `.chat-item[data-chat-id="${chatId}"]`
    );
    if (!chatItem) return;

    const otherUserId = Number(chatItem.getAttribute('data-user-id'));

    // Do not join if I blocked them or they blocked me
    if (window.iBlockedUsers && window.iBlockedUsers.includes(otherUserId)) {
        const headerStatus = document.getElementById('chat-status');
        if (headerStatus) headerStatus.innerText = "";
        return;
    }

    if (window.blockedByUsers && window.blockedByUsers.includes(otherUserId)) {
        const headerStatus = document.getElementById('chat-status');
        if (headerStatus) headerStatus.innerText = "";
        return;
    }

    // If channel already exists, update status immediately from cached members
    if (window.chatPresenceChannels[chatId]) {

        const channel = window.chatPresenceChannels[chatId];

        if (channel.subscription && channel.subscription.members) {
            channel.members = channel.subscription.members;
        }

        if (channel.members && channel.members.members) {

            const members = Object.values(channel.members.members);
            const otherOnline = members.some(u => u.id != window.AUTH_USER_ID);
            const headerStatus = document.getElementById('chat-status');

            if (headerStatus) {
                if (otherOnline) {
                    headerStatus.innerText = "online";
                    headerStatus.style.color = "#25D366";
                } else {
                    const otherUser = members.find(u => u.id != window.AUTH_USER_ID);
                    if (otherUser) {
                        fetchLastSeen(otherUser.id, headerStatus);
                    }
                }
            }
        }

        return;
    }

    // Join fresh presence channel
    const channel = window.EchoInstance.join('chat.presence.' + chatId)
        .here((users) => {

            const headerStatus = document.getElementById('chat-status');
            if (!headerStatus) return;

            const currentOtherUserId = Number(window.currentOtherUserId);
            if (!currentOtherUserId) return;

            const memberIds = users.map(u => Number(u.id));
            const isOnline = memberIds.includes(currentOtherUserId);

            if (isOnline) {
                headerStatus.innerText = "online";
                headerStatus.style.color = "#25D366";
            } else {
                // Wait for global presence dot before showing last seen
                setTimeout(() => {
                    if (String(window.currentChatId) !== String(chatId)) return;
                    const hs = document.getElementById('chat-status');
                    if (!hs) return;
                    if (hs.innerText === 'online') return;

                    // Check global presence dot first
                    const sidebarItem = document.querySelector(
                        `.chat-item[data-user-id="${currentOtherUserId}"]`
                    );
                    if (sidebarItem && sidebarItem.querySelector('.online-dot')) {
                        hs.innerText = "online";
                        hs.style.color = "#25D366";
                        return;
                    }

                    if (window.chatPresenceChannels[chatId] &&
                        window.chatPresenceChannels[chatId]._joined) {
                        return;
                    }
                    fetchLastSeen(currentOtherUserId, hs);
                }, 2000);
            }
        })

        .joining((user) => {
            if (user.id != window.AUTH_USER_ID) {
                if (window.chatPresenceChannels[chatId]) {
                    window.chatPresenceChannels[chatId]._joined = true;
                }
                setUserOnline(chatId, user.id);
            }
        })

        .leaving((user) => {
            if (user.id != window.AUTH_USER_ID) {
                // Re-check after short delay — user may have just switched chats
                setTimeout(() => {
                    // Only show offline if user is actually offline in global presence
                    const isStillOnline = document.querySelector(
                        `.chat-item[data-user-id="${user.id}"] .online-dot`
                    );
                    if (!isStillOnline) {
                        setUserOffline(chatId, user.id);
                    }
                }, 3000);
            }
        });

    window.chatPresenceChannels[chatId] = channel;
};

/*
|--------------------------------------------------------------------------
| FETCH LAST SEEN HELPER
|--------------------------------------------------------------------------
*/
function fetchLastSeen(userId, headerStatus) {

    if (window.theyBlockedMe) {
        headerStatus.innerText = "";
        return;
    }

    // If global presence dot exists — user is online, skip last seen
    const sidebarItem = document.querySelector(
        `.chat-item[data-user-id="${userId}"]`
    );
    if (sidebarItem && sidebarItem.querySelector('.online-dot')) {
        headerStatus.innerText = "online";
        headerStatus.style.color = "#25D366";
        return;
    }

    // Check global presence first — if online dot exists, show online
    const chatItem = document.querySelector(
        `.chat-item[data-user-id="${userId}"]`
    );
    if (chatItem && chatItem.querySelector('.online-dot')) {
        headerStatus.innerText = "online";
        headerStatus.style.color = "#25D366";
        return;
    }

    $.ajax({
        url: '/user/last-seen/' + userId,
        method: 'GET',
        success: function(response) {
            if (!headerStatus) return;
            headerStatus.innerText = response.last_seen
                ? "last seen " + response.last_seen
                : "";
            headerStatus.style.color = "#8696a0";
        },
        error: function() {
            if (headerStatus) headerStatus.innerText = "";
        }
    });
}

/*
|--------------------------------------------------------------------------
| SET USER ONLINE
|--------------------------------------------------------------------------
*/
function setUserOnline(chatId, userId) {

    // Do not show online if blocked
    if (window.iBlockedUsers && window.iBlockedUsers.includes(userId)) return;
    if (window.blockedByUsers && window.blockedByUsers.includes(userId)) return;

    // Sidebar dot
    const chatItem = document.querySelector(
        `.chat-item[data-chat-id="${chatId}"]`
    );
    if (chatItem) {
        let dot = chatItem.querySelector('.online-dot');
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'online-dot';
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.background = '#25D366';
            dot.style.borderRadius = '50%';
            dot.style.display = 'inline-block';
            dot.style.marginLeft = '6px';
            chatItem.querySelector('.chat-name').appendChild(dot);
        }
    }

    // Chat header
    const headerStatus = document.getElementById('chat-status');
    if (headerStatus && !window.theyBlockedMe) {
        headerStatus.innerText = "online";
        headerStatus.style.color = "#25D366";
    }
}

/*
|--------------------------------------------------------------------------
| SET USER OFFLINE
|--------------------------------------------------------------------------
*/
function setUserOffline(chatId, userId) {

    // Remove sidebar dot
    const chatItem = document.querySelector(
        `.chat-item[data-chat-id="${chatId}"]`
    );
    if (chatItem) {
        const dot = chatItem.querySelector('.online-dot');
        if (dot) dot.remove();
    }

    // Update chat header
    const headerStatus = document.getElementById('chat-status');
    if (headerStatus) {
        fetchLastSeen(userId, headerStatus);
    }
}

/*
|--------------------------------------------------------------------------
| JOIN GLOBAL PRESENCE
|--------------------------------------------------------------------------
*/
function joinGlobalPresence() {

    if (window.globalPresenceChannel) return;

    window.globalPresenceChannel = window.EchoInstance.join('global.presence')

        .here((users) => {
            users.forEach(user => setGlobalOnline(user.id));
        })

        .joining((user) => {
            setGlobalOnline(user.id);
        })

        .leaving((user) => {
            setGlobalOffline(user.id);
        });
}

/*
|--------------------------------------------------------------------------
| SET GLOBAL ONLINE
|--------------------------------------------------------------------------
*/
function setGlobalOnline(userId) {

    if (userId == window.AUTH_USER_ID) return;
    if (window.iBlockedUsers && window.iBlockedUsers.includes(userId)) return;
    if (window.blockedByUsers && window.blockedByUsers.includes(userId)) return;

    const chatItem = document.querySelector(
        `.chat-item[data-user-id="${userId}"]`
    );
    if (chatItem) {
        let dot = chatItem.querySelector('.online-dot');
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'online-dot';
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.background = '#25D366';
            dot.style.borderRadius = '50%';
            dot.style.display = 'inline-block';
            dot.style.marginLeft = '6px';
            chatItem.querySelector('.chat-name').appendChild(dot);
        }
    }
}

/*
|--------------------------------------------------------------------------
| SET GLOBAL OFFLINE
|--------------------------------------------------------------------------
*/
function setGlobalOffline(userId) {

    const chatItem = document.querySelector(
        `.chat-item[data-user-id="${userId}"]`
    );
    if (chatItem) {
        const dot = chatItem.querySelector('.online-dot');
        if (dot) dot.remove();
    }
}

/*
|--------------------------------------------------------------------------
| APPLY GLOBAL ONLINE DOT TO A NEWLY CREATED CHAT ITEM
| Call this immediately after prepending a new .chat-item to the sidebar.
| Reads live presence members synchronously — no setTimeout, no race condition.
|--------------------------------------------------------------------------
*/
window.applyGlobalDotIfOnline = function(chatItem, userId) {

    userId = Number(userId);

    if (!userId) return;
    if (userId === Number(window.AUTH_USER_ID)) return;
    if (window.iBlockedUsers  && window.iBlockedUsers.includes(userId)) return;
    if (window.blockedByUsers && window.blockedByUsers.includes(userId)) return;

    // Read members directly from the live global presence channel
    const members = window.globalPresenceChannel
        && window.globalPresenceChannel.subscription
        && window.globalPresenceChannel.subscription.members
        && window.globalPresenceChannel.subscription.members.members;

    if (!members) return;

    const isOnline = Object.values(members)
        .some(u => Number(u.id) === userId);

    if (!isOnline) return;

    // Apply dot synchronously — element is already in the DOM at this point
    let dot = chatItem.querySelector('.online-dot');
    if (!dot) {
        dot = document.createElement('span');
        dot.className        = 'online-dot';
        dot.style.width      = '10px';
        dot.style.height     = '10px';
        dot.style.background = '#25D366';
        dot.style.borderRadius = '50%';
        dot.style.display    = 'inline-block';
        dot.style.marginLeft = '6px';

        const nameEl = chatItem.querySelector('.chat-name');
        if (nameEl) nameEl.appendChild(dot);
    }
};

/*
|--------------------------------------------------------------------------
| UPDATE LAST SEEN ON PAGE UNLOAD
|--------------------------------------------------------------------------
*/
window.addEventListener('beforeunload', function() {
    fetch('/user/update-last-seen', {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': document
                .querySelector('meta[name="csrf-token"]')
                .getAttribute('content'),
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        keepalive: true
    });
});

/*
|--------------------------------------------------------------------------
| INIT GLOBAL PRESENCE ON DOM READY
|--------------------------------------------------------------------------
*/
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        joinGlobalPresence();
    }, 200);
});