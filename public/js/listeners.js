window.blockedUsersRealtime = {};

// ✅ Mark all undelivered messages as delivered on page load
fetch('/messages/mark-all-delivered', {
    method: 'POST',
    headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
        'Content-Type': 'application/json'
    }
});

window.ChatSystem = {

    activeChatId: null,
    chatChannel: null,
    sidebarChannels: {},

    /*
    |--------------------------------------------------------------------------
    | SIDEBAR LISTENER
    |--------------------------------------------------------------------------
    */
    listenSidebar(chatId, chatItem) {

        if (this.sidebarChannels[chatId]) return;

        const channel = window.EchoInstance.private('chat.' + chatId);

        /*
        | SIDEBAR: MESSAGE SENT
        */
        channel.listen('.message.sent', (e) => {

            const message = e.message;

            // Always query fresh from DOM — do not rely on stale chatItem reference
            let existingItem = document.querySelector(`.chat-item[data-chat-id="${message.chat_id}"]`);
            

            if (!existingItem) {
                // Only rebuild if I am the RECEIVER (not sender)
                // This handles the case where receiver had deleted this chat
                if (message.sender_id == window.AUTH_USER_ID) return;

                const newItem = document.createElement('div');
                newItem.className = 'chat-item';
                newItem.setAttribute('data-chat-id', message.chat_id);
                newItem.setAttribute('data-user-id', message.sender_id);
                newItem.setAttribute('data-unread', '1');
                newItem.setAttribute('data-pinned', '0');
                newItem.setAttribute('data-original-message', message.message ?? '');
                newItem.innerHTML = `
                    <img src="${message.sender_photo ?? '/default.png'}" class="chat-img">
                    <div class="chat-info">
                        <div class="chat-name">
                            <span class="chat-title">${escapeHtml(message.sender_name ?? 'User')}</span>
                            <span class="chat-pin-icon" style="display:none;">📌</span>
                        </div>
                        <div class="chat-last">${escapeHtml(message.message ?? '')}</div>
                    </div>
                    <div class="chat-time" data-time="${message.created_at ?? ''}">
                    </div>
                `;

                // Set time
                const timeEl = newItem.querySelector('.chat-time');
                if (timeEl) {
                    timeEl.dataset.time = message.created_at
                        ? new Date(message.created_at.replace(' ', 'T')).toISOString()
                        : new Date().toISOString();
                    refreshSidebarTime(timeEl);

                    // Add unread badge
                    const badge = document.createElement('div');
                    badge.className = 'unread-count';
                    badge.innerText = '1';
                    timeEl.appendChild(badge);
                }

                const chatList = document.querySelector('.chat-list');
                if (chatList) chatList.prepend(newItem);

                // ✅ Apply green dot instantly if sender is already in global presence
                window.applyGlobalDotIfOnline(newItem, message.sender_id);

// Register sidebar listener for this rebuilt item
                ChatSystem.listenSidebar(message.chat_id, newItem);
                markDelivered(message.id);
                updateUnreadFilterCount();
                return;
            }

            // Refresh chatItem reference in case it was rebuilt
            chatItem = document.querySelector(`.chat-item[data-chat-id="${message.chat_id}"]`) || chatItem;

            // Ignore if message not visible to me
            if (message.visible_to &&
                !message.visible_to.includes(window.AUTH_USER_ID)) {
                return;
            }

            // Ignore if this user is blocked in realtime
            const otherUserId = chatItem.getAttribute('data-user-id');
            if (window.blockedUsersRealtime[otherUserId] === true) return;

            const lastMsg = chatItem.querySelector('.chat-last');
            if (lastMsg) {

                // STOP typing animation if it is running
                if (chatItem.typingInterval) {
                    clearInterval(chatItem.typingInterval);
                    chatItem.typingInterval = null;
                }

                // also clear typing timeout
                if (chatItem.sidebarTypingTimeout) {
                    clearTimeout(chatItem.sidebarTypingTimeout);
                    chatItem.sidebarTypingTimeout = null;
                }

                lastMsg.innerText = message.deleted_for_everyone
                    ? "This message was deleted"
                    : message.message;

                lastMsg.style.color = "";
                chatItem.dataset.originalMessage = message.message;
            }

            // Update sidebar time
            const timeEl = chatItem.querySelector('.chat-time');
            if (timeEl) {
                const parsedTime = message.created_at
                    ? new Date(message.created_at.replace(' ', 'T'))
                    : new Date();
                timeEl.dataset.time = parsedTime.toISOString();
                refreshSidebarTime(timeEl);
            }

            // Mark delivered
            if (message.sender_id != window.AUTH_USER_ID) {
                markDelivered(message.id);
            }

            // Unread count badge
            if (message.sender_id != window.AUTH_USER_ID) {

                // Skip incrementing unread if this chat is currently open
                if (window.currentChatId != chatItem.dataset.chatId) {

                    let badge = chatItem.querySelector('.unread-count');

                    if (e.unread_count > 0) {
                        if (!badge) {
                            badge = document.createElement('div');
                            badge.className = 'unread-count';
                            badge.style.background = '#25D366';
                            badge.style.color = 'white';
                            badge.style.borderRadius = '50%';
                            badge.style.padding = '3px 7px';
                            badge.style.fontSize = '12px';
                            badge.style.marginTop = '4px';
                            timeEl.appendChild(badge);
                        }
                        badge.innerText = e.unread_count;
                        chatItem.dataset.unread = e.unread_count;
                    } else {
                        if (badge) badge.remove();
                        chatItem.dataset.unread = 0;
                    }

                    // Now update the filter counter instantly
                    updateUnreadFilterCount();
                }
            }

            // Only move to top for receiver — sender side handled in chat.js
            if (message.sender_id != window.AUTH_USER_ID) {
                const chatList = document.querySelector('.chat-list');
                if (chatList) {
                    if (chatList.firstElementChild !== chatItem) {
                        PinChat.moveToTopIfNotPinned(chatItem);
                    }
                }
            }
        });

        /*
        | SIDEBAR: TYPING
        */
        channel.listen('.user.typing', (e) => {
            handleTypingEvent(e.userId, chatId);
        });

        /*
        | SIDEBAR: MESSAGE DELETED
        */
        channel.listen('.message.deleted', (e) => {

            const lastMsg = chatItem.querySelector('.chat-last');
            if (!lastMsg) return;

            const otherUserId = chatItem.getAttribute('data-user-id');

            // Ignore if blocked in realtime
            if (window.blockedUsersRealtime[otherUserId] === true) return;

            // Ignore if message not visible to me
            if (e.visible_to &&
                !e.visible_to.includes(window.AUTH_USER_ID)) {
                return;
            }

            // Only update if sidebar currently shows THIS message
            const originalMessage = chatItem.dataset.originalMessage;
            if (!originalMessage) return;
            if (lastMsg.innerText.trim() !== originalMessage) return;

            lastMsg.innerHTML = "<i>This message was deleted</i>";
        });

        this.sidebarChannels[chatId] = channel;
    },

    /*
    |--------------------------------------------------------------------------
    | USER CHANNEL LISTENER (block/unblock events)
    |--------------------------------------------------------------------------
    */
    listenUserChannel(authUserId) {

        console.log('listenUserChannel started for:', authUserId);

        window.EchoInstance.private('user.' + authUserId)
            .listen('.user.blocked', (e) => {

                const otherUserId = (e.blockerId == window.AUTH_USER_ID)
                    ? e.blockedId
                    : e.blockerId;

                const isBlocked = (e.action === 'blocked');

                // Update realtime blocked map
                window.blockedUsersRealtime[otherUserId] = isBlocked;

                // Ensure arrays exist
                if (!window.iBlockedUsers) window.iBlockedUsers = [];
                if (!window.blockedByUsers) window.blockedByUsers = [];

                if (isBlocked) {

                    // I blocked them
                    if (e.blockerId == window.AUTH_USER_ID) {
                        if (!window.iBlockedUsers.includes(otherUserId)) {
                            window.iBlockedUsers.push(otherUserId);
                        }
                    }

                    // They blocked me
                    if (e.blockedId == window.AUTH_USER_ID) {
                        if (!window.blockedByUsers.includes(otherUserId)) {
                            window.blockedByUsers.push(otherUserId);
                        }
                    }

                    // Leave presence channel immediately
                    if (window.currentChatId) {
                        window.EchoInstance.leave('chat.presence.' + window.currentChatId);
                        delete window.chatPresenceChannels[window.currentChatId];
                    }

                    // Clear chat header status instantly
                    const headerStatus = document.getElementById('chat-status');
                    if (headerStatus) headerStatus.innerText = "";

                    // Remove online dot from sidebar
                    const chatItem = document.querySelector(
                        `.chat-item[data-user-id="${otherUserId}"]`
                    );
                    if (chatItem) {
                        const dot = chatItem.querySelector('.online-dot');
                        if (dot) dot.remove();
                    }

                    // Update block state for current chat
                    if (String(window.currentOtherUserId) === String(otherUserId)) {
                        window.iBlocked = true;
                    }

                    // Show "Tap to unblock" on system message
                    if (String(window.currentOtherUserId) === String(otherUserId)) {
                        const lastSystemMsg = document.querySelector(
                            '#chat-messages .msg-system:last-child'
                        );
                        if (lastSystemMsg &&
                            lastSystemMsg.innerText.trim() === 'You blocked this contact.') {
                            lastSystemMsg.innerHTML = `
                                You blocked this contact.
                                <span onclick="unblockUser(${otherUserId})"
                                      style="color:#25D366;cursor:pointer;margin-left:6px;">
                                    Tap to unblock
                                </span>
                            `;
                        }
                    }

                } else {

                    // Clear from blocked arrays
                    window.iBlockedUsers =
                        window.iBlockedUsers.filter(id => id != otherUserId);
                    window.blockedByUsers =
                        window.blockedByUsers.filter(id => id != otherUserId);

                    // Reset theyBlockedMe if I was the blocked one
                    if (e.blockedId == window.AUTH_USER_ID) {
                        window.theyBlockedMe = false;
                    }

                    // Update block state for current chat
                    if (String(window.currentOtherUserId) === String(otherUserId)) {
                        window.iBlocked = false;
                    }

               // Rejoin presence channel
                    if (window.currentChatId) {
                        delete window.chatPresenceChannels[window.currentChatId];
                        window.EchoInstance.leave('chat.presence.' + window.currentChatId);
                        setTimeout(() => {
                            joinPresenceChannel(window.currentChatId);
                        }, 1500);
                    }

                    // ✅ Re-apply green dot after unblock — arrays are cleared above
                    setTimeout(() => {
                        setGlobalOnline(otherUserId);
                    }, 100);
                }

                // Update photos (sidebar + header)
                let newPhoto = null;

                if (window.AUTH_USER_ID == e.blockedId) {
                    // I am blocked → show default photo
                    newPhoto = isBlocked ? '/default.png' : e.blockerPhoto;
                }

                if (window.AUTH_USER_ID == e.blockerId) {
                    // I blocked someone → still see their real photo
                    newPhoto = e.blockedPhoto;
                }

                if (newPhoto) {
                    const sidebarImg = document.querySelector(
                        `.chat-item[data-user-id="${otherUserId}"] .chat-img`
                    );
                    if (sidebarImg) {
                        sidebarImg.src = newPhoto + '?t=' + Date.now();
                    }

                    if (String(window.currentOtherUserId) === String(otherUserId)) {
                        const headerImg = document.querySelector('.chat-header img');
                        if (headerImg) {
                            headerImg.src = newPhoto + '?t=' + Date.now();
                        }
                    }
                }
            });

        // Listen for messages in deleted chats via personal channel
        window.EchoInstance.private('user.messages.' + authUserId)
            .listen('.message.sent', (e) => {

                const message = e.message;
                if (!message) return;

                const existingItem = document.querySelector(
                    `.chat-item[data-chat-id="${message.chat_id}"]`
                );
                if (existingItem) return;

                const newItem = document.createElement('div');
                newItem.className = 'chat-item';
                newItem.setAttribute('data-chat-id', message.chat_id);
                newItem.setAttribute('data-user-id', message.sender_id);
                newItem.setAttribute('data-unread', '1');
                newItem.setAttribute('data-pinned', '0');
                newItem.setAttribute('data-original-message', message.message ?? '');
                newItem.innerHTML = `
                    <img src="${message.sender_photo ?? '/default.png'}" class="chat-img">
                    <div class="chat-info">
                        <div class="chat-name">
                            <span class="chat-title">${escapeHtml(message.sender_name ?? 'User')}</span>
                            <span class="chat-pin-icon" style="display:none;">📌</span>
                        </div>
                        <div class="chat-last">${escapeHtml(message.message ?? '')}</div>
                    </div>
                    <div class="chat-time" data-time="">
                    </div>
                `;

                const timeEl = newItem.querySelector('.chat-time');
                if (timeEl) {
                    timeEl.dataset.time = message.sent_at
                        ? new Date(message.sent_at.replace(' ', 'T')).toISOString()
                        : new Date().toISOString();
                    refreshSidebarTime(timeEl);

                    const badge = document.createElement('div');
                    badge.className = 'unread-count';
                    badge.innerText = '1';
                    timeEl.appendChild(badge);
                }

                const chatList = document.querySelector('.chat-list');
                if (chatList) chatList.prepend(newItem);

                // ✅ Apply green dot instantly if sender is already in global presence
                // Replaces the old unreliable setTimeout block — reads live members synchronously
                window.applyGlobalDotIfOnline(newItem, message.sender_id);

                // Remove stale sidebar channel so old listener stops firing
                if (ChatSystem.sidebarChannels[message.chat_id]) {
                    window.EchoInstance.leave('chat.' + message.chat_id);
                    delete ChatSystem.sidebarChannels[message.chat_id];
                }

                ChatSystem.listenSidebar(message.chat_id, newItem);
                markDelivered(message.id);
                updateUnreadFilterCount();
            });
    },

    /*
    |--------------------------------------------------------------------------
    | CHAT LISTENER
    |--------------------------------------------------------------------------
    */
    listenChat(chatId) {

        if (this.chatChannel) {
            window.EchoInstance.leave('chat.' + this.activeChatId);
        }

        this.activeChatId = chatId;

        // Join presence channel
        joinPresenceChannel(chatId);

        this.chatChannel = window.EchoInstance.private('chat.' + chatId);

        this.chatChannel.listen('.message.sent',   (e) => handleMessageSent(e));
        this.chatChannel.listen('.message.edited',  (e) => handleMessageEdited(e));
        this.chatChannel.listen('.message.deleted', (e) => handleMessageDeleted(e));
        this.chatChannel.listen('.user.typing',     (e) => handleTypingEvent(e.userId, chatId));

    }

};

/*
|--------------------------------------------------------------------------
| UNBLOCK USER
|--------------------------------------------------------------------------
*/
window.unblockUser = function(userId) {

    $.ajax({
        url: '/unblock',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        data: JSON.stringify({ user_id: userId }),
        success: function() {
            window.iBlocked = false;
            const systemMsg = document.querySelector('.msg-system:last-child');
            if (systemMsg) {
                systemMsg.innerText = "You unblocked this contact.";
            }
        }
    });
};