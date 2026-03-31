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
    : message.media
        ? (message.media.mime_type?.startsWith('image') ? '📷 Photo'
         : message.media.mime_type?.startsWith('video') ? '🎥 Video'
         : message.media.mime_type?.startsWith('audio') ? '🎵 Audio'
         : '📄 ' + (message.media.file_name ?? 'Document'))
          + (message.message ? ' ' + message.message : '')
        : message.message ?? '';

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


            // ADD THIS RIGHT AFTER:
// ✅ If shared panel is open, append new file to correct pane instantly
if(message.media && document.getElementById('shared-screen')?.classList.contains('active')){

    const mime = message.media.mime_type ?? '';
    let paneType = null;

    if(mime.startsWith('image') || mime.startsWith('video')) paneType = 'media';
    else if(mime.startsWith('audio')) paneType = 'audio';
    else paneType = 'docs';

    const container = document.getElementById('shared-container');
    const pane = container?.querySelector(`.tab-pane[data-type="${paneType}"]`);

if(pane){
    // ✅ Prevent duplicate — skip if this message already exists in pane
    if(pane.querySelector(`[data-id="${message.id}"]`) ||
       pane.querySelector(`[data-url="/media/${message.id}"]`)){
        return;
    }

    // ✅ Increment shared count on profile panel instantly
    const countEl = document.getElementById('shared-count');
    if(countEl){
        const current = parseInt(countEl.innerText) || 0;
        countEl.innerText = current + 1;
    }

    const isMine = message.sender_id == window.AUTH_USER_ID;

        if(paneType === 'media'){
            let grid = pane.querySelector('.media-grid');
            if(!grid){
                grid = document.createElement('div');
                grid.className = 'media-grid';
                pane.prepend(grid);
            }
            const div = document.createElement('div');
            div.className = 'media-thumb';
            const thumb = message.media.thumbnail_path ? `/media/thumb/${message.id}` : '';
            div.innerHTML = `
                <div class="media-grid-item"
                     data-media-view
                     data-url="/media/${message.id}"
                     data-type="${message.type}"
                     data-sender="${message.sender_id}"
                     data-file-size="${message.media.file_size}"
                     data-thumb="${message.id}">
                    <img src="${thumb}" class="grid-thumb" loading="lazy">
                    ${!isMine ? `<div class="grid-download-overlay">⬇</div>` : ``}
                </div>
            `;
            if(isMine){
                const img = div.querySelector('.grid-thumb');
                const overlay = div.querySelector('.grid-download-overlay');
                if(img) img.classList.remove('blurred');
                if(overlay) overlay.remove();
            } else {
                const img = div.querySelector('.grid-thumb');
                if(img) img.classList.add('blurred');
            }
            grid.prepend(div);
        }

        if(paneType === 'audio'){

            function formatTime(sec){
                const m = Math.floor(sec / 60);
                const s = Math.floor(sec % 60);
                return `${m}:${s < 10 ? '0'+s : s}`;
            }

            const div = document.createElement('div');

            if(isMine || message.downloaded){
                div.className = 'audio-item';
                div.dataset.id = message.id;
                div.innerHTML = `
                    <div class="audio-play">▶</div>
                    <div class="audio-info">
                        <div class="audio-name">${message.media.file_name}</div>
                        <div class="audio-time">0:00</div>
                        <div class="audio-progress">
                            <div class="audio-progress-bar"></div>
                        </div>
                    </div>
                `;

                let audio = ProfilePanel.audioObjects[message.id];
                if(!audio){
                    audio = new Audio(`/media/${message.id}`);
                    audio.preload = 'metadata'; // ✅ fetch duration immediately
                    ProfilePanel.audioObjects[message.id] = audio;
                }

                const playBtn = div.querySelector('.audio-play');
                const timeEl  = div.querySelector('.audio-time');
                const bar     = div.querySelector('.audio-progress-bar');
                const progressContainer = div.querySelector('.audio-progress');

                if(audio.duration && !isNaN(audio.duration)){
                    timeEl.innerText = formatTime(audio.duration);
                }

                audio.onloadedmetadata = () => { timeEl.innerText = formatTime(audio.duration); };

                progressContainer.onclick = function(e){
                    if(!audio.duration) return;
                    const rect = progressContainer.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    audio.currentTime = percent * audio.duration;
                    if(!audio.paused) audio.play();
                };

                playBtn.onclick = function(){
                    if(window.profileAudio && window.profileAudio !== audio){
                        window.profileAudio.pause();
                        if(window.currentAudioDiv){
                            window.currentAudioDiv.classList.remove('playing');
                            window.currentAudioDiv.querySelector('.audio-play').innerText = '▶';
                        }
                    }
                    if(audio.paused){
                        audio.play();
                        playBtn.innerText = '⏸';
                        div.classList.add('playing');
                        window.profileAudio = audio;
                        window.currentAudioDiv = div;
                    } else {
                        audio.pause();
                        playBtn.innerText = '▶';
                        div.classList.remove('playing');
                    }
                };

                audio.ontimeupdate = () => {
                    const percent = (audio.currentTime / audio.duration) * 100;
                    bar.style.width = percent + '%';
                    timeEl.innerText = formatTime(audio.currentTime);
                };

                audio.onended = () => {
                    bar.style.width = '0%';
                    playBtn.innerText = '▶';
                    div.classList.remove('playing');
                    timeEl.innerText = formatTime(audio.duration);
                };

        } else {
    div.className = 'audio-item';
    div.dataset.id = message.id;
    div.style.opacity = '0.6';
    div.style.cursor = 'pointer';
    div.innerHTML = `
        <div class="audio-play" style="background:#2a3942;font-size:16px;">🔒</div>
        <div class="audio-info">
            <div class="audio-name">${message.media.file_name}</div>
            <div class="audio-time">--:--</div>
            <div class="audio-progress">
                <div class="audio-progress-bar"></div>
            </div>
        </div>
    `;
}

pane.prepend(div);
        }

        if(paneType === 'docs'){
            const div = document.createElement('div');
            if(isMine || message.downloaded){
                div.style.cursor = 'pointer';
                div.innerHTML = `📄 ${message.media.file_name}`;
                div.onclick = function(){ window.open(`/media/${message.id}`, '_blank'); };
            } else {
                div.style.opacity = '0.6';
                div.style.cursor = 'pointer';
                div.innerHTML = `🔒 📄 ${message.media.file_name}`;
            }
            pane.prepend(div);
        }
    }
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

    const isBlockedSidebar =
        (window.blockedUsersRealtime[otherUserId] === true) ||
        (window.iBlockedUsers && window.iBlockedUsers.includes(Number(otherUserId))) ||
        (window.blockedByUsers && window.blockedByUsers.includes(Number(otherUserId)));
    if (isBlockedSidebar) return;

    if (e.visible_to && !e.visible_to.includes(window.AUTH_USER_ID)) return;

    // ✅ only update sidebar if the deleted message is the last one in the chat
    // Check via the chat messages container if chat is open
    if(window.currentChatId == chatItem.dataset.chatId) {
        // chat is open — check DOM for last bubble
        const lastBubble = [...document.querySelectorAll('#chat-messages .msg[data-id]')].pop();
        if(!lastBubble || lastBubble.dataset.id != e.message_id) return;
    } else {
        // chat is not open — fallback to originalMessage comparison
        const originalMessage = chatItem.dataset.originalMessage ?? '';
        if(!originalMessage) return;
        if(lastMsg.innerText.trim() !== originalMessage.trim()) return;
    }

    lastMsg.innerHTML = "<i>This message was deleted</i>";
    chatItem.dataset.originalMessage = 'This message was deleted';
});

        /*
| SIDEBAR: MESSAGE EDITED
*/
channel.listen('.message.edited', (e) => {
    const message = e.message;
    if(!message) return;
 // ✅ If visible_to is set and does NOT include me — ignore completely
    if(message.visible_to && !message.visible_to.includes(window.AUTH_USER_ID)) return;
    // Refresh chatItem reference
    chatItem = document.querySelector(`.chat-item[data-chat-id="${message.chat_id}"]`) || chatItem;
    if(!chatItem) return;

    const otherUserId = chatItem.getAttribute('data-user-id');

    // Ignore if blocked
    if(window.blockedUsersRealtime[otherUserId] === true) return;
    if(window.iBlockedUsers && window.iBlockedUsers.includes(Number(otherUserId))) return;
    if(window.blockedByUsers && window.blockedByUsers.includes(Number(otherUserId))) return;

    // Only update sidebar if this edited message is the currently shown last message
    const lastMsg = chatItem.querySelector('.chat-last');
    if(!lastMsg) return;

    lastMsg.innerText = message.message ?? '';
    chatItem.dataset.originalMessage = message.message ?? '';
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
            })


    // ✅ ADD THIS — update tick to double grey when delivered
    .listen('.message.delivered', (e) => {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const bubble = container.querySelector(`[data-id="${e.message_id}"]`);
        if (!bubble) return;

        const timeDiv = bubble.querySelector('.time');
        if (!timeDiv) return;

        // Only update if currently single tick
        if (!timeDiv.innerHTML.includes('✔✔')) {
            timeDiv.innerHTML = timeDiv.innerHTML.replace('✔', '✔✔');
        }
    })

    // ✅ ADD THIS — update tick to double blue when seen
    .listen('.message.seen', (e) => {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const bubble = container.querySelector(`[data-id="${e.message_id}"]`);
        if (!bubble) return;

        const timeDiv = bubble.querySelector('.time');
        if (!timeDiv) return;

        // Replace any tick with blue double tick
        if (!timeDiv.innerHTML.includes('#53bdeb')) {
            timeDiv.innerHTML = timeDiv.innerHTML.replace(
                /✔✔|✔/,
                '<span style="color:#53bdeb">✔✔</span>'
            );
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

      this.chatChannel.listen('.message.sent', (e) => {

    handleMessageSent(e);

    // ✅ mark message seen if chat is currently open
    if (window.currentChatId == e.message.chat_id &&
        e.message.sender_id != window.AUTH_USER_ID) {

        fetch('/message/seen/' + e.message.id, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        });

    }

});
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

            // ✅ Remove "Tap to unblock" span from the block message (keep the text)
            const allSystemMsgs = document.querySelectorAll('.msg-system');
            allSystemMsgs.forEach(function(msg) {
                if (msg.innerText.includes('You blocked this contact.')) {
                    msg.innerText = 'You blocked this contact.';
                }
            });

            // ✅ Append a NEW system message for unblock instead of overwriting
            const msgContainer = document.getElementById('chat-messages');
            if (msgContainer) {
                const div = document.createElement('div');
                div.className = 'msg-system';
                div.innerText = 'You unblocked this contact.';
                msgContainer.appendChild(div);
                msgContainer.scrollTop = msgContainer.scrollHeight;
            }
        }
    });
};
