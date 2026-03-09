window.blockedUsersRealtime = {};

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
                lastMsg.innerText = message.deleted_for_everyone
                    ? "This message was deleted"
                    : message.message;

                lastMsg.style.color = "";
                chatItem.dataset.originalMessage = message.message;
            }

            // Update sidebar time
            const timeEl = chatItem.querySelector('.chat-time');
            if (timeEl) {
                let timeText = timeEl.querySelector('.time-text');
                if (!timeText) {
                    timeText = document.createElement('div');
                    timeText.className = 'time-text';
                    timeEl.prepend(timeText);
                }
                timeText.innerText = formatSidebarTime(message.created_at);
            }

            // Mark delivered
            if (message.sender_id != window.AUTH_USER_ID) {
                markDelivered(message.id);
            }

            // Unread count badge
            if (message.sender_id != window.AUTH_USER_ID) {
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
                        badge.style.marginLeft = 'auto';
                        chatItem.appendChild(badge);
                    }
                    badge.innerText = e.unread_count;
                } else {
                    if (badge) badge.remove();
                }
            }

            // Move chat to top
            const chatList = document.querySelector('.chat-list');
            if (chatList && chatItem.parentNode === chatList) {
                if (chatList.firstElementChild !== chatItem) {
                    chatList.prepend(chatItem);
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