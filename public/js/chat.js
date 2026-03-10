// ...existing code...

/*
|--------------------------------------------------------------------------
| GLOBAL STATE
|--------------------------------------------------------------------------
*/
if(window.APP_PAGE === "starred"){
    console.log("Starred page — chat system disabled");
}
window.currentChatId = localStorage.getItem('currentChatId');
window.currentOtherUserId = localStorage.getItem('currentChatUserId');

/*
|--------------------------------------------------------------------------
| FORMAT TIME
|--------------------------------------------------------------------------
*/
function formatTime(date) {

    if(!date) date = new Date();

    const time = new Date(date).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // ✅ force AM/PM uppercase
    return time.replace('am','AM').replace('pm','PM');
}

/*
|--------------------------------------------------------------------------
| UUID + HELPERS
|--------------------------------------------------------------------------
*/
function generateUUID() {
    // simple RFC4122 v4 style generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function escapeHtml(unsafe) {
    if(!unsafe && unsafe !== 0) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/*
|--------------------------------------------------------------------------
| RENDER MESSAGE CONTENT
|--------------------------------------------------------------------------
*/
function renderMessageContent(msg) {

    if(msg.media) {
        return MediaDownloader.render(msg);
    }

    if(msg.link_preview){

        const p = msg.link_preview;

return `
<a href="${p.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
<div class="link-preview"
     data-url="${p.url}"
     style="
        border:1px solid #2a3942;
        border-radius:8px;
        overflow:hidden;
        max-width:320px;
        margin-top:4px;
        cursor:pointer;
     ">

    ${p.image ? `
    <img src="${p.image}" style="
        width:100%;
        height:150px;
        object-fit:cover;
    ">` : ''}

  <div style="padding:8px">
        <div style="font-weight:500;font-size:14px;color:white">
            ${p.title ?? p.url}
        </div>
        <div style="font-size:12px;color:#8696a0;margin-top:3px;">
            ${p.domain ?? ''}
        </div>
    </div>
    <div style="padding:4px 8px 8px 8px;">
        <a href="${p.url}" target="_blank" rel="noopener noreferrer"
           style="font-size:13px;color:#53bdeb;word-break:break-all;text-decoration:none;">
            ${p.url}
        </a>
    </div>

</div>
</a>
`;
    }

    if(msg.message){

        let text = escapeHtml(msg.message).replace(/\n/g, '<br>');

        text = text.replace(
            /((https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*)/g,
            '<a href="$1" target="_blank" style="color:#53bdeb">$1</a>'
        );

        return text;
    }

    return '';
}


/*
|--------------------------------------------------------------------------
| MARK DELIVERED / SEEN
|--------------------------------------------------------------------------
*/
function markDelivered(messageId) {
    $.ajax({
        url: '/message/delivered/' + messageId,
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        }
    });
}

function markSeen(messageId) {
    $.ajax({
        url: '/message/seen/' + messageId,
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        }
    });
}

/*
|--------------------------------------------------------------------------
| OPEN CHAT
|--------------------------------------------------------------------------
*/
function openChat(chatId, item) {
    window.currentChatId = chatId;
    window.currentOtherUserId = item.getAttribute('data-user-id');
    const chatUserName = document.getElementById('chat-user-name');
    if (chatUserName) chatUserName.setAttribute('data-user-id', item.getAttribute('data-user-id'));

    localStorage.setItem('currentChatId', chatId);
    localStorage.setItem('currentChatUserId', window.currentOtherUserId);

    loadMessages(chatId, item);
}

/*
|--------------------------------------------------------------------------
| FORMAT MESSAGE DATE
|--------------------------------------------------------------------------
*/
function formatMessageDate(dateString) {
    const msgDate = new Date(dateString);
    const today = new Date();

    const msg = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffDays = Math.floor((now - msg) / (1000*60*60*24));

    if(diffDays === 0) return "Today";
    if(diffDays === 1) return "Yesterday";

    function getWeekNumber(d) {
        d = new Date(d);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(),0,1);
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    const msgWeek = getWeekNumber(msg);
    const nowWeek = getWeekNumber(now);

    if(msgWeek === nowWeek && msg.getFullYear() === now.getFullYear()) {
        return msg.toLocaleDateString(undefined, { weekday:'long' });
    }

    const day = msg.getDate().toString().padStart(2,'0');
    const month = (msg.getMonth()+1).toString().padStart(2,'0');
    const year = msg.getFullYear();

    return `${day}/${month}/${year}`;
}

/*
|--------------------------------------------------------------------------
| LOAD MESSAGES
|--------------------------------------------------------------------------
*/
function loadMessages(chatId, item) {
    $.ajax({
        url: '/chat/' + chatId + '?mark_seen=1',
        method: 'GET',
        success: function(data) {
            window.theyBlockedMe = data.they_blocked_me ?? false;
            window.iBlocked = data.i_blocked ?? false;
            const container = document.getElementById('chat-container');
            if(!container) return;

            let messagesHtml = '';
            let lastDate = null;

            data.messages.forEach(msg => {
                const msgDateObj = new Date(msg.created_at);
                const msgDate = msgDateObj.toDateString();

                if(lastDate !== msgDate) {
                    messagesHtml += `<div class="msg-date">${formatMessageDate(msg.created_at)}</div>`;
                    lastDate = msgDate;
                }
if(
    msg.message === 'You blocked this contact.' ||
    msg.message === 'You unblocked this contact.' ||
    msg.message === 'You pinned a message'
){

    let content = msg.message;

    // ✅ Show link ONLY if:
    // 1. This is a block message
    // 2. I am currently blocking
    // 3. This is the LAST message in chat

    const isLastMessage =
        data.messages[data.messages.length - 1].id === msg.id;

    if(
        msg.message === 'You blocked this contact.' &&
        window.iBlocked === true &&
        isLastMessage
    ){
        content = `
            You blocked this contact.
            <span onclick="unblockUser(${window.currentOtherUserId})"
                  style="color:#25D366;cursor:pointer;margin-left:6px;">
                Tap to unblock
            </span>
        `;
    }

    messagesHtml += `
        <div class="msg-system">
            ${content}
        </div>
    `;
    return;
}
                const isMine = msg.sender_id == window.AUTH_USER_ID;

                let tick = '';
              if(isMine) {
    if(msg.seen_at && msg.seen_at !== null){
        tick = '<span style="color:#53bdeb">✔✔</span>';
    }else if(msg.delivered_at){
        tick = '✔✔';
    }else{
        tick = '✔';
    }
}

                const time = formatTime(msg.edited_at ?? msg.sent_at ?? msg.created_at);
// AFTER
let replyHtml = '';

if(msg.reply){

const isMine = msg.sender_id == window.AUTH_USER_ID;
const replyAuthor = isMine ? 'You' : escapeHtml(msg.sender_name ?? 'User');
const replyText = msg.reply.message
    ? escapeHtml(msg.reply.message)
    : getReplyMediaLabel(msg.reply);

let thumb = '';

if(msg.reply.media){
thumb = `
<div style="width:36px;height:36px;overflow:hidden;border-radius:4px;margin-left:8px;">
${MediaDownloader.render(msg.reply)}
</div>`;
}

replyHtml = `
<div class="reply-quote" data-reply-id="${msg.reply.id}" style="display:flex;align-items:center;justify-content:space-between;">
<div>
<div class="reply-author">${replyAuthor}</div>
<div class="reply-text">${replyText}</div>
</div>
${thumb}
</div>`;

}

messagesHtml += `
<div class="msg ${isMine?'msg-right':'msg-left'}"
     data-id="${msg.id}"
     data-created-at="${msg.created_at}"
     data-pinned="${msg.is_pinned ? 1 : 0}"
     data-starred="${msg.is_starred ? 1 : 0}">
     <div class="msg-hover-arrow"></div>

     ${replyHtml}
    ${ msg.deleted_for_everyone ? '<i>This message was deleted</i>' : `<div class="msg-content">${renderMessageContent(msg)}</div>` }
<div class="time">
   ${msg.is_pinned ? '<span class="msg-pin">📌</span>' : ''}
   ${msg.is_starred ? '<span class="star-icon">⭐</span>' : ''}
   ${time}
   ${msg.edited_at ? ' (edited)' : ''}
   ${isMine ? tick : ''}
</div>

</div>
`;
            });

            

            container.innerHTML = `

<div class="chat-header" style="display:flex;align-items:center;gap:10px;padding:10px;">
   <img src="${
    window.blockedUsersRealtime[window.currentOtherUserId]
        ? '/default.png'
        : item.querySelector('.chat-img').src
}" onclick="ProfilePanel.open()" style="width:40px;height:40px;border-radius:50%;cursor:pointer;">
    <div style="display:flex;flex-direction:column;">
        <span id="chat-user-name" onclick="ProfilePanel.open()" style="cursor:pointer;font-weight:500;" data-user-id="${window.currentOtherUserId}">
            ${item.querySelector('.chat-name').innerText}
        </span>
        <span id="chat-status" style="font-size:12px;color:#8696a0;"></span>
    </div>
</div>
<div id="pinned-bar" class="pinned-bar" style="display:none;"></div>

<div id="chat-messages" class="chat-messages">
     ${messagesHtml.length === 0 ? '<div class="msg-date">Today</div>' : messagesHtml}
</div>
  <button id="scroll-to-bottom" class="scroll-bottom-btn">
    <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor"
              d="M7 10l5 5 5-5z"/>
    </svg>
</button>

    <div id="typing-indicator" style="font-size:13px;color:#53bdeb;"></div>

<div id="media-preview-bar" style="display:none;padding:10px;background:#111b21;border-top:1px solid #222;">
    <div id="media-preview-list" style="display:flex;gap:8px;overflow-x:auto;margin-bottom:8px;"></div>
    <input id="media-caption-input" placeholder="Add a caption..." style="width:100%;padding:8px;background:#2a3942;border:none;color:white;border-radius:6px;outline:none;">
</div>
<!-- REPLY PREVIEW -->
<div id="reply-preview"
     style="display:none;
            padding:8px 12px;
            background:#2a3942;
            border-left:4px solid #25D366;
            align-items:center;
            justify-content:space-between;">

    <div style="display:flex;flex-direction:column;">
        <div id="reply-user" style="font-size:12px;color:#25D366;font-weight:500;"></div>
        <div id="reply-text"
             style="font-size:13px;color:#d1d7db;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
    </div>

    <button id="reply-cancel"
            style="background:none;border:none;color:#8696a0;font-size:18px;cursor:pointer;">
        ✕
    </button>

</div>

<!-- INPUT BAR -->
<div class="chat-input" style="display:flex;align-items:center;gap:10px;padding:10px;background:#202c33;">
    <input type="file" id="media-input" hidden multiple onchange="previewMedia(event)">
    <div style="position:relative;">
        <button onclick="toggleAttachMenu()" id="attach-button" style="background:none;border:none;color:#8696a0;font-size:22px;cursor:pointer;">➕</button>
        <div id="attach-menu" style="display:none;position:absolute;bottom:50px;left:0;background:#233138;border-radius:12px;padding:8px 0;width:220px;box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:999;">
            ${renderAttachMenu()}
        </div>
    </div>

   <textarea id="message-input"
placeholder="Type message"
rows="1"
style="flex:1;
background:#2a3942;
border:none;
color:white;
padding:10px;
border-radius:8px;
outline:none;
resize:none;
max-height:120px;
overflow-y:auto;"></textarea>

    <button onclick="handleSendAction()" id="send-button" style="background:#25D366;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;padding:0;"
        onmouseover="this.style.background='#20bd5a'" onmouseout="this.style.background='#25D366'" onmousedown="this.style.transform='scale(0.92)'" onmouseup="this.style.transform='scale(1)'">
        <svg viewBox="0 0 24 24" width="18" height="18" style="display:block;fill:white;margin-left:2px;">
            <path d="M3.4,20.4L21.85,12L3.4,3.6v6.6l13.2,1.8l-13.2,1.8V20.4z"/>
        </svg>
    </button>
</div>
`;

            // use global var
         const otherUserId = window.currentOtherUserId;
if(otherUserId){
    // ✅ Do not show last seen if I blocked them or they blocked me
    const isBlocked =
        (window.iBlockedUsers && window.iBlockedUsers.includes(Number(otherUserId))) ||
        (window.blockedByUsers && window.blockedByUsers.includes(Number(otherUserId)));

    if(!isBlocked){
        $.ajax({
            url: '/user/last-seen/' + otherUserId,
            method: 'GET',
            success: function(response){
                const headerStatus = document.getElementById('chat-status');
                if(!headerStatus) return;
                if(headerStatus.innerText === 'online') return;
                if(response.last_seen) headerStatus.innerText = "last seen " + response.last_seen;
                else headerStatus.innerText = "";
            }
        });
    }
}

            const msgContainer = document.getElementById('chat-messages');
  const scrollBtn = document.getElementById('scroll-to-bottom');

msgContainer.addEventListener('scroll', function(){

    const isNearBottom =
        msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 100;

    if(isNearBottom){
        scrollBtn.classList.remove('show');
    } else {
        scrollBtn.classList.add('show');
    }
});

scrollBtn.onclick = function(){
    msgContainer.scrollTo({
        top: msgContainer.scrollHeight,
        behavior: 'smooth'
    });
};
            if(msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

            // -------------------------------
// RENDER PINNED SYSTEM MESSAGES
// -------------------------------
if(data.pinned_messages && data.pinned_messages.length){
    renderPinnedBar(data.pinned_messages);
}

// ✅ RESTORE paused uploads from DB (status = uploading)
$.ajax({
    url: '/upload/pending/' + window.currentChatId,
    method: 'GET',
    success: function(response){

        if(!response || !response.uploads) return;

        response.uploads.forEach(upload => {
            // skip duplicates in case the server accidentally returns the same
            // session twice (or a previous paused/uploading pair).
            if(document.querySelector(`[data-upload-uuid="${upload.upload_uuid}"]`)) {
                return;
            }

            const bubble = document.createElement('div');
            bubble.className = 'msg msg-right';
            bubble.dataset.uploadUuid = upload.upload_uuid;

       const container = document.getElementById('chat-messages');

const uploadTime = new Date(upload.created_at).getTime();

let inserted = false;

container.querySelectorAll('.msg').forEach(msg => {
    const msgTimeAttr = msg.getAttribute('data-created-at');
    if(!msgTimeAttr) return;
    const msgTime = new Date(msgTimeAttr).getTime();
    if(uploadTime < msgTime && !inserted) {
        container.insertBefore(bubble, msg);
        inserted = true;
    }
});

if(!inserted) {
    container.appendChild(bubble);
}

const thumbKey = upload.upload_uuid + '_thumb';
const dbReq = indexedDB.open('UploadDB', 1);
dbReq.onsuccess = function(ev) {
    const db = ev.target.result;
    const tx = db.transaction(['files'], 'readonly');
    const getThumb = tx.objectStore('files').get(thumbKey);
    getThumb.onsuccess = function() {
        const thumbSrc = getThumb.result || null;
        bubble.innerHTML = `
            <div class="wa-media-box resume-upload"
                 style="width:260px;height:180px;padding:0;overflow:hidden;border-radius:8px;margin:-4px;position:relative;cursor:pointer;">
                ${thumbSrc
                    ? `<img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover;display:block;">`
                    : `<div style="width:100%;height:100%;background:#1d282f;"></div>`
                }
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
                    <svg width="48" height="48" viewBox="0 0 48 48" style="cursor:pointer;">
                        <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.25)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                        <polyline points="24,15 24,33" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                        <polyline points="16,22 24,14 32,22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                    <div style="font-size:11px;color:white;font-weight:500;background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:8px;">${(upload.file_size / (1024*1024)).toFixed(1)} MB</div>
                </div>
            </div>
        `;
        bubble.querySelector('.resume-upload').onclick = () => {
            MediaUpload.resumeUpload(
                upload.upload_uuid,
                null,
                bubble,
                null
            );
        };
    };
};
        });

    }
});


            ChatSystem.listenChat(chatId);
        }
    });
}

/*
|--------------------------------------------------------------------------
| SEND MESSAGE
|--------------------------------------------------------------------------
*/
window.sendMessage = function() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if(!message) return;

  if(window.editingMessageId) {
    const editingId = window.editingMessageId;
    $.ajax({
        url: '/message/edit/' + editingId,
        method: 'POST',
        headers: {
            'Content-Type':'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        data: JSON.stringify({ message: message }),
        success: function(response){
            // ✅ update sender's own bubble locally — no broadcast needed
            const el = document.querySelector(`[data-id="${editingId}"]`);
            if(!el) return;

         const existingPreview = el.querySelector('.link-preview');
const linkPreviewData = existingPreview ? {
    url: existingPreview.dataset.url,
    title: existingPreview.querySelector('[style*="font-weight:500"]')?.textContent?.trim(),
    image: existingPreview.querySelector('img')?.src ?? null,
    domain: existingPreview.querySelector('[style*="color:#8696a0"]')?.textContent?.trim()
} : null;
const newContent = renderMessageContent({message: message, link_preview: linkPreviewData});
            const timeDiv = el.querySelector('.time');

            const msgContent = el.querySelector('.msg-content');
            if(msgContent){
                msgContent.innerHTML = newContent;
            } else {
                for(const node of el.childNodes){
                    if(node === timeDiv) continue;
                    if(node === el.querySelector('.msg-hover-arrow')) continue;
                    if(node === el.querySelector('.reply-quote')) continue;
                    if(node.nodeType === 3) continue;
                    node.classList.add('msg-content');
                    node.innerHTML = newContent;
                    break;
                }
            }

           if(timeDiv){
                const tick = response.seen_at
                    ? '<span style="color:#53bdeb">✔✔</span>'
                    : response.delivered_at ? '✔✔' : '✔';

                // ✅ preserve star icon on sender side after edit
                const wasStarred = el.dataset.starred === '1';
                const starHtml = wasStarred ? '<span class="star-icon">⭐</span>' : '';
                timeDiv.innerHTML = starHtml + formatTime(response.edited_at ?? response.created_at) + ' <span>(edited)</span> ' + tick;
            }

            // ✅ update starred panel card instantly on sender side
            const starredCard = document.querySelector(
                `#starred-list [data-message-id="${editingId}"]`
            );
            if(starredCard){
                const bubbleText = starredCard.querySelector('.starred-msg-text');
                if(bubbleText) bubbleText.textContent = message;
            }
            // ✅ also update pinned cache if this message is pinned
if(window.pinnedMessages){
    window.pinnedMessages.forEach(p => {
        if(p.id == editingId){
            p.message = message;
        }
    });

    if(window.pinnedMessages.length){
        renderPinnedBar(window.pinnedMessages);
    }
}
        }
        
    });
    window.editingMessageId = null;
    input.value = '';
    return;
}

    // optimistic render for sender (instant local message)
    const uploadUUID = generateUUID();
    const container = document.getElementById('chat-messages');
    if(container) {
        const timeNow = formatTime(new Date());
        const bubble = document.createElement('div');
        bubble.className = 'msg msg-right';
        bubble.setAttribute('data-upload-uuid', uploadUUID);
        bubble.setAttribute('data-uploading', '1');
        bubble.setAttribute('data-created-at', new Date().toISOString());
        // safe text rendering to avoid XSS
       let replyHtml = '';

if(window.replyMessage){
replyHtml = `
<div class="reply-quote" data-reply-id="${window.replyMessage.id}">
<div class="reply-author">You</div>
<div class="reply-text">${escapeHtml(window.replyMessage.text)}</div>
</div>`;
}
// ✅ Add Today separator if no messages exist yet
        if(!container.querySelector('.msg-date')){
            const dateDiv = document.createElement('div');
            dateDiv.className = 'msg-date';
            dateDiv.innerText = 'Today';
            container.appendChild(dateDiv);
        }

        bubble.innerHTML =
`<div class="msg-hover-arrow"></div>` +
replyHtml +
`<div class="msg-content">${renderMessageContent({message:message})}</div>
<div class="time">${timeNow} ✔</div>`;
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    $.ajax({
        url:'/message/send',
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
       data: JSON.stringify({
    chat_id: window.currentChatId,
    message: message,
    reply_to: window.replyMessage ? window.replyMessage.id : null,
    upload_uuid: uploadUUID
}),
success: function(response) {
    if(response && response.message && container) {
        const uploadingBubble = container.querySelector(`[data-upload-uuid="${uploadUUID}"]`);
        if(uploadingBubble) {
            uploadingBubble.removeAttribute('data-uploading');
            uploadingBubble.dataset.id = response.message.id;
            if(response.message.link_preview){
    const content = uploadingBubble.querySelector('.msg-content');
    if(content){
        content.innerHTML = renderMessageContent(response.message);
    }
}
            uploadingBubble.setAttribute('data-finished','1');
            const _time = formatTime(response.message.sent_at ?? response.message.created_at ?? new Date());
            const _tick = response.message.seen_at ? '<span style="color:#53bdeb">✔✔</span>' : response.message.delivered_at ? '✔✔' : '✔';
            const timeDiv = uploadingBubble.querySelector('.time');
            if(timeDiv){
                timeDiv.innerHTML = `${_time} ${_tick}`;
            }
        }
    }
  const chatItem = document.querySelector(`.chat-item[data-chat-id="${window.currentChatId}"]`);
const chatList = document.querySelector('.chat-list');

if(chatItem && chatList){

    // ✅ update sidebar last message instantly
    const preview = chatItem.querySelector('.chat-last');
    const timeEl = chatItem.querySelector('.chat-time');

    if(preview){
        preview.innerHTML = escapeHtml(message);
    }

    if(timeEl){
        timeEl.dataset.time = new Date().toISOString();
        refreshSidebarTime(timeEl);
    }

    // keep chat on top
    if(chatList.firstElementChild !== chatItem){
        chatList.prepend(chatItem);
    }
}
    window.replyMessage = null;
    const replyBox = document.getElementById('reply-preview');
    if(replyBox) replyBox.style.display = 'none';
}
    });

    input.value = '';
};


/*
|--------------------------------------------------------------------------
| RECEIVE MESSAGE REALTIME
|--------------------------------------------------------------------------
*/
function handleMessageSent(e) {
    console.log('handleMessageSent fired', e.seen_message_ids, e.message?.id);
    const container = document.getElementById('chat-messages');
    if(!container) return;

    const message = e.message;

    // prevent duplicate after finished uploads
 const existingFinished = container.querySelector(`[data-id="${message.id}"][data-finished="1"]`);
    if(existingFinished) {
        const tickDiv = existingFinished.querySelector('.time');
        if(tickDiv) {
            let tick = '✔';
            if(message.seen_at) tick = '<span style="color:#53bdeb">✔✔</span>';
            else if(message.delivered_at) tick = '✔✔';
            tickDiv.innerHTML = formatTime(message.sent_at ?? message.created_at) + ' ' + tick;
        }
        // ✅ process all seen_message_ids before returning
        if(e.seen_message_ids && e.seen_message_ids.length) {
            const seenSet = new Set(e.seen_message_ids.map(id => parseInt(id)));
            container.querySelectorAll('.msg-right').forEach(msg => {
                const id = parseInt(msg.dataset.id);
                if(!id || !seenSet.has(id)) return;
                const tickDiv = msg.querySelector('.time');
                if(!tickDiv) return;
                if(!tickDiv.innerHTML.includes('#53bdeb')) {
                    tickDiv.innerHTML = tickDiv.innerHTML.replace(/✔✔|✔/, '<span style="color:#53bdeb">✔✔</span>');
                }
            });
        }
        return;
    }

    // find uploading bubble by upload_uuid if supported
    let uploadingBubble = null;
    if(message.upload_uuid) {
        uploadingBubble = container.querySelector(`.msg[data-upload-uuid="${message.upload_uuid}"]`);
    }

    if(uploadingBubble && message.sender_id == window.AUTH_USER_ID) {
        uploadingBubble.removeAttribute('data-uploading');
        uploadingBubble.dataset.id = message.id;
        uploadingBubble.dataset.finished = "1";
        const _tick = message.seen_at ? '<span style="color:#53bdeb">✔✔</span>' : message.delivered_at ? '✔✔' : '✔';
        uploadingBubble.innerHTML =
    `<div class="msg-content">${renderMessageContent(message)}</div>` +
    `<div class="time">${formatTime(message.sent_at ?? message.created_at)} ${_tick}</div>`;
        return;
    }

    // block duplicates by upload_uuid
  const existingUpload = container.querySelector(`[data-upload-uuid="${message.upload_uuid}"]`);

if(existingUpload && !existingUpload.dataset.id) {
    existingUpload.dataset.id = message.id;

    const tick =
        message.seen_at ? '<span style="color:#53bdeb">✔✔</span>' :
        message.delivered_at ? '✔✔' : '✔';
existingUpload.innerHTML =
    `<div class="msg-content">${renderMessageContent(message)}</div>` +
    `<div class="time">${formatTime(message.sent_at ?? message.created_at)} ${tick}</div>`;

    return;
}

   // if sender and we don't have uploadingBubble, ensure we only update ticks for existing element
    if(!uploadingBubble && message.sender_id == window.AUTH_USER_ID) {
        const existing = container.querySelector(`[data-id="${message.id}"]`);
        if(existing) {
            const tickDiv = existing.querySelector('.time');
            if(tickDiv) {
                let tick = '✔';
                if(message.seen_at) tick = '<span style="color:#53bdeb">✔✔</span>';
                else if(message.delivered_at) tick = '✔✔';
                tickDiv.innerHTML = formatTime(message.sent_at ?? message.created_at) + ' ' + tick;
            }
        }
        // ✅ always process seen_message_ids for ALL bubbles before returning
        if(e.seen_message_ids && e.seen_message_ids.length) {
            const seenSet = new Set(e.seen_message_ids.map(id => parseInt(id)));
            container.querySelectorAll('.msg-right').forEach(msg => {
                const id = parseInt(msg.dataset.id);
                if(!id || !seenSet.has(id)) return;
                const tickDiv = msg.querySelector('.time');
                if(!tickDiv) return;
                if(!tickDiv.innerHTML.includes('#53bdeb')) {
                    tickDiv.innerHTML = tickDiv.innerHTML.replace(/✔✔|✔/, '<span style="color:#53bdeb">✔✔</span>');
                }
            });
        }
        return;
    }

    // update ticks if element exists
let existingMsg = container.querySelector(`[data-id="${message.id}"]`);
if(existingMsg) {

    // ⭐ UPDATE MESSAGE CONTENT (for link preview upgrade)
    const content = existingMsg.querySelector('.msg-content');
    if(content){
        content.innerHTML = renderMessageContent(message);
    }

    // existing tick update
    if(message.sender_id == window.AUTH_USER_ID) {
        const tickDiv = existingMsg.querySelector('.time');
        if(tickDiv) {
            let newTick = '✔';
            if(message.seen_at) newTick = '<span style="color:#53bdeb">✔✔</span>';
            else if(message.delivered_at) newTick = '✔✔';

            tickDiv.innerHTML = formatTime(message.sent_at ?? message.created_at) + ' ' + newTick;
        }
    }

    return;
}

    const isMine = message.sender_id == window.AUTH_USER_ID;

    // Receiver side actions
    if(!isMine) {
        markDelivered(message.id);
        if(window.currentChatId == message.chat_id) {
            markSeen(message.id);
        }
    }

    // Sender side multi-blue ticks update
if(e.seen_message_ids && e.seen_message_ids.length){

    const seenSet = new Set(e.seen_message_ids.map(id => parseInt(id)));

    container.querySelectorAll('.msg-right').forEach(msg => {

        const id = parseInt(msg.dataset.id);
        if(!id) return;

        if(seenSet.has(id)){

            const tickDiv = msg.querySelector('.time');
            if(!tickDiv) return;

            if(!tickDiv.innerHTML.includes('#53bdeb')){
                tickDiv.innerHTML =
                    tickDiv.innerHTML.replace(/✔✔|✔/, '<span style="color:#53bdeb">✔✔</span>');
            }

        }

    });

}

    // Prevent duplicate render one more time
    let existing = container.querySelector(`[data-id="${message.id}"]`);
    if(existing) {
        const tickDiv = existing.querySelector('.time');
        if(tickDiv) {
            if(message.seen_at) tickDiv.innerHTML = tickDiv.innerHTML.replace(/✔✔|✔/, '<span style="color:#53bdeb">✔✔</span>');
            else if(message.delivered_at) tickDiv.innerHTML = tickDiv.innerHTML.replace(/✔✔|✔/, '✔✔');
        }
        return;
    }

    // initial tick state
    let tick = '';
    if(isMine) {
        if(message.seen_at) tick = '<span style="color:#53bdeb">✔✔</span>';
        else if(message.delivered_at) tick = '✔✔';
        else tick = '✔';
    }

    const time = formatTime(message.sent_at ?? message.created_at);

    const _msg = document.createElement('div');
    _msg.className = `msg ${isMine ? 'msg-right' : 'msg-left'}`;
    _msg.dataset.id = message.id;
// AFTER
let replyHtml='';

if(message.reply){

const isMine = message.sender_id == window.AUTH_USER_ID;
const replyAuthor = isMine ? 'You' : escapeHtml(message.sender_name ?? 'User');

const replyText = message.reply.message
? escapeHtml(message.reply.message)
: getReplyMediaLabel(message.reply);

let thumb='';

if(message.reply.media){
thumb=`
<div style="width:36px;height:36px;overflow:hidden;border-radius:4px;margin-left:8px;">
${MediaDownloader.render(message.reply)}
</div>`;
}

replyHtml=`
<div class="reply-quote" data-reply-id="${message.reply.id}" style="display:flex;align-items:center;justify-content:space-between;">
<div>
<div class="reply-author">${replyAuthor}</div>
<div class="reply-text">${replyText}</div>
</div>
${thumb}
</div>`;
}

_msg.innerHTML =
`<div class="msg-hover-arrow"></div>`
+ replyHtml
+ `<div class="msg-content">${renderMessageContent(message)}</div>`
+ `<div class="time">${time}</div>`;

    // ✅ Add Today separator if no messages exist yet
    if(!container.querySelector('.msg-date')){
        const dateDiv = document.createElement('div');
        dateDiv.className = 'msg-date';
        dateDiv.innerText = 'Today';
        container.appendChild(dateDiv);
    }

 container.appendChild(_msg);

    container.scrollTop = container.scrollHeight;

    // ✅ FIX: update sidebar for receiver when chat is already open
    if(!isMine){
        const sidebarItem = document.querySelector(`.chat-item[data-chat-id="${message.chat_id}"]`);
        const chatList = document.querySelector('.chat-list');

        if(sidebarItem && chatList){

            // ✅ update last message text
            const preview = sidebarItem.querySelector('.chat-last');
            if(preview){
                preview.innerText = message.deleted_for_everyone
                    ? "This message was deleted"
                    : message.message ?? '';
                preview.style.color = "";
                sidebarItem.dataset.originalMessage = message.message ?? '';
            }

            // ✅ update time
            const timeEl = sidebarItem.querySelector('.chat-time');
            if(timeEl){
                const parsedTime = message.created_at
                    ? new Date(message.created_at.replace(' ', 'T'))
                    : new Date();
                timeEl.dataset.time = parsedTime.toISOString();
                refreshSidebarTime(timeEl);
            }

            // ✅ move to top
            if(chatList.firstElementChild !== sidebarItem){
                chatList.prepend(sidebarItem);
            }
        }
    }

}

/*
|--------------------------------------------------------------------------
| RENDER NEW MESSAGE (used by upload finish mappings)
|--------------------------------------------------------------------------
*/
function renderNewMessage(message) {
    const container = document.getElementById('chat-messages');
    if(!container) return;
    if(container.querySelector(`[data-id="${message.id}"]`)) return;

    const isMine = message.sender_id == window.AUTH_USER_ID;
    let tick = '';
    if(isMine) {
        if(message.seen_at) tick = '<span style="color:#53bdeb">✔✔</span>';
        else if(message.delivered_at) tick = '✔✔';
        else tick = '✔';
    }

    const time = formatTime(message.sent_at ?? message.created_at);
    const _msg = document.createElement('div');
    _msg.className = `msg ${isMine ? 'msg-right' : 'msg-left'}`;
    _msg.dataset.id = message.id;
    _msg.innerHTML = renderMessageContent(message) + `<div class="time">${time} ${isMine ? tick : ''}</div>`;
    container.appendChild(_msg);
    container.scrollTop = container.scrollHeight;
}

/*
|--------------------------------------------------------------------------
| MESSAGE EDITED
|--------------------------------------------------------------------------
*/
function handleMessageEdited(e) {
    const otherUserId = window.currentOtherUserId;

    // ✅ block check — ignore edit events from/to blocked users
    const isBlockedRealtime = window.blockedUsersRealtime && window.blockedUsersRealtime[otherUserId] === true;
    const iBlockedThem = window.iBlocked === true;
    const theyBlockedMe = window.theyBlockedMe === true;

    if(isBlockedRealtime || iBlockedThem || theyBlockedMe){
        return;
    }

   const message = e.message;

    // ✅ ALWAYS update starred panel BEFORE early return
    const editedStarCard = document.querySelector(
        `#starred-list [data-message-id="${message.id}"]`
    );
    if(editedStarCard){
        const bubbleText = editedStarCard.querySelector('.starred-msg-text');
        if(bubbleText) bubbleText.textContent = message.message ?? '';
    }

    const el = document.querySelector(`[data-id="${message.id}"]`);
    if(!el) return;

    // Update content (works for simple content; media cases handled server-side)
    // If message has media, server render may be required; we keep safe text replace:
if(message.message !== undefined && message.message !== null){
    const timeDiv = el.querySelector('.time');
   const newContent = renderMessageContent(message);

    // ✅ Try .msg-content first (loadMessages after refresh)
    const msgContent = el.querySelector('.msg-content');

    if(msgContent){
        msgContent.innerHTML = newContent;
    } else {
        // realtime bubble — no .msg-content wrapper, walk childNodes
        const hoverArrow = el.querySelector('.msg-hover-arrow');
        const replyQuote = el.querySelector('.reply-quote');
        let contentNode = null;

        for(const node of el.childNodes){
            if(node === timeDiv) continue;
            if(node === hoverArrow) continue;
            if(node === replyQuote) continue;
            if(node.nodeType === 3) continue;
            contentNode = node;
            break;
        }
if(contentNode){
    contentNode.classList.add('msg-content'); // ✅ upgrade for future edits
    contentNode.innerHTML = newContent;
} else {
    const div = document.createElement('div');
    div.className = 'msg-content';
    div.innerHTML = newContent;
    el.insertBefore(div, timeDiv);
}
    }
}

    let tick = '';
    if(message.sender_id == window.AUTH_USER_ID) {
        if(message.seen_at) tick = '<span style="color:#53bdeb">✔✔</span>';
        else if(message.delivered_at) tick = '✔✔';
        else tick = '✔';
    }

  const timeDiv = el.querySelector('.time');
    if(timeDiv) {
        // ✅ preserve star icon if message was starred
        const wasStarred = el.dataset.starred === '1';
        const starHtml = wasStarred ? '<span class="star-icon">⭐</span>' : '';
        timeDiv.innerHTML = starHtml + formatTime(message.edited_at ?? message.created_at) + ' <span>(edited)</span> ' + tick;
    }

    // ✅ update starred panel card instantly if open
    const starredCard = document.querySelector(
        `#starred-list [data-message-id="${message.id}"]`
    );
    if(starredCard){
        const starredText = starredCard.querySelector('.starred-msg-text');
        if(starredText){
            starredText.textContent = message.message;
        } else {
            // find the text node inside the bubble content div
            const bubbleContent = starredCard.querySelector(
                '[style*="background:#005c4b"] span'
            );
            if(bubbleContent){
                bubbleContent.textContent = message.message ?? '';
            }
        }
    }
if(e.seen_message_ids && e.seen_message_ids.length > 0){

    container.querySelectorAll('.msg-right').forEach(msg => {

        const id = parseInt(msg.dataset.id);
        if(!id) return;

        if(e.seen_message_ids.includes(id)){

            const tickDiv = msg.querySelector('.time');
            if(!tickDiv) return;

            tickDiv.innerHTML =
                tickDiv.innerHTML.replace(/✔✔|✔/, '<span style="color:#53bdeb">✔✔</span>');
        }

    });

}
}

/*
|--------------------------------------------------------------------------
| MESSAGE DELETED
|--------------------------------------------------------------------------
*/
function handleMessageDeleted(e) {

    // 🚫 STOP if this user is blocked in realtime
    const otherUserId = window.currentOtherUserId;

    if(window.blockedUsersRealtime &&
       window.blockedUsersRealtime[otherUserId] === true) {

        console.log("Delete event ignored due to block state");
        return;
    }

  // ✅ ALWAYS remove from starred panel — before any early return
    const starredCard = document.querySelector(
        `#starred-list [data-message-id="${e.message_id}"]`
    );
    if(starredCard){
        starredCard.style.transition = 'opacity 0.2s ease';
        starredCard.style.opacity = '0';
        setTimeout(() => starredCard.remove(), 200);
    }

    // ✅ ALWAYS unstar from DB for delete-for-everyone — before any early return
    if(e.type === 'everyone'){
        fetch('/message/unstar-on-delete/' + e.message_id, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            }
        });
    }

    const el = document.querySelector(`[data-id="${e.message_id}"]`);

    // ⭐ remove pinned message if deleted
    if(window.pinnedMessages){
        window.pinnedMessages = window.pinnedMessages.filter(
            p => p.id != e.message_id
        );
        if(window.pinnedMessages.length){
            renderPinnedBar(window.pinnedMessages);
        } else {
            const bar = document.getElementById('pinned-bar');
            if(bar) bar.style.display = 'none';
        }
    }

    if(!el) return;

    if(e.type === 'everyone') {
        el.innerHTML = '<i>This message was deleted</i>';
    }
if(e.type === 'me') {

    if(e.user_id == window.AUTH_USER_ID){

        el.remove();

        // ✅ unstar the message silently so it disappears from starred panel
        fetch('/message/unstar-on-delete/' + e.message_id, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            }
        });
// ✅ also remove from starred panel UI if currently open
        const starredCard = document.querySelector(
            `#starred-list [data-message-id="${e.message_id}"]`
        );
        if(starredCard) starredCard.remove();

        // ⭐ remove pinned message if needed
        if(window.pinnedMessages){

            window.pinnedMessages = window.pinnedMessages.filter(
                p => p.id != e.message_id
            );

            if(window.pinnedMessages.length){
                renderPinnedBar(window.pinnedMessages);
            }else{
                const bar = document.getElementById('pinned-bar');
                if(bar) bar.style.display = 'none';
            }

        }

    }

}

    const activeChat = document.querySelector(
        `.chat-item[data-chat-id="${window.currentChatId}"]`
    );

    if(activeChat) {

        const lastMsg =
        document.querySelector('#chat-messages .msg:last-child');

        const preview =
        activeChat.querySelector('.chat-last');

        const time =
        activeChat.querySelector('.chat-time');

        if(lastMsg) {

            const text =
            lastMsg.childNodes[0]?.textContent?.trim() ?? '';

            const timeText =
            lastMsg.querySelector('.time')?.textContent?.trim();

            preview.innerHTML = text;

            if(timeText)
           time.dataset.time = new Date().toISOString();
    refreshSidebarTime(time);

        } else {

            preview.innerHTML = '';
            time.innerHTML = '';
        }
    }
}

/*
|--------------------------------------------------------------------------
| TYPING INDICATOR
|--------------------------------------------------------------------------
*/
function handleTyping(e) {
    if(e.userId == window.AUTH_USER_ID) return;
    const typing = document.getElementById('typing-indicator');
    if(!typing) return;
    typing.innerText = "Typing...";
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => { typing.innerText = ""; },1500);
}

/*
|--------------------------------------------------------------------------
| SEND TYPING EVENT
|--------------------------------------------------------------------------
*/
let lastTypingSent = 0;

document.addEventListener('input', function(e){

    if(e.target.id !== 'message-input') return;
    if(!window.currentChatId) return;

    // ✅ If input is cleared, immediately stop typing indicator
    if(e.target.value.trim() === '') {
        hideSidebarTyping(window.currentChatId);

        const chatItem = document.querySelector(`.chat-item[data-chat-id="${window.currentChatId}"]`);
        if(chatItem && chatItem.sidebarTypingTimeout){
            clearTimeout(chatItem.sidebarTypingTimeout);
            chatItem.sidebarTypingTimeout = null;
        }

        // Also stop header typing indicator
        stopTypingIndicator();
        const statusEl = document.getElementById('chat-status');
        if(statusEl && statusEl.dataset.originalStatus !== undefined){
            statusEl.innerText = statusEl.dataset.originalStatus || "";
            statusEl.style.color = statusEl.innerText === "online" ? "#25D366" : "#8696a0";
            delete statusEl.dataset.originalStatus;
        }
        clearTimeout(typingTimeout);
        return;
    }

    const now = Date.now();

    // ✅ send typing event only every 800ms
    if(now - lastTypingSent < 800) return;

    lastTypingSent = now;

    $.ajax({
        url: '/typing',
        method: 'POST',
        headers: {
            'Content-Type':'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        data: JSON.stringify({ chat_id: window.currentChatId })
    });

});

/*
|--------------------------------------------------------------------------
| MEDIA UPLOAD / PREVIEW
|--------------------------------------------------------------------------
*/
function sendMedia() {
    const input = document.getElementById('media-input');
    const files = input.files;
    if(!files.length) return;

    const captionInput = document.getElementById('media-caption-input');
    let caption = '';
    if(captionInput && captionInput.value) caption = captionInput.value.trim();

    for(let file of files) {
        MediaUpload.uploadSingle(file, caption);
    }

    removeMediaPreview();
    input.value = '';
}

function previewMedia(event) {
    const files = event.target.files;
    if(!files.length) return;
    const previewBar = document.getElementById('media-preview-bar');
    const previewList = document.getElementById('media-preview-list');
    previewList.innerHTML = '';
    previewBar.style.display = 'block';

    Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        let element;
        if(file.type.startsWith('image')) {
            element = document.createElement('img');
            element.src = url;
        } else if(file.type.startsWith('video')) {
            element = document.createElement('video');
            element.src = url;
        } else if(file.type.startsWith('audio')) {
            element = document.createElement('div');
            element.innerHTML = '🎵';
        } else {
            element = document.createElement('div');
            element.innerHTML = '📄';
        }

        element.style.width = '60px';
        element.style.height = '60px';
        element.style.objectFit = 'cover';
        element.style.borderRadius = '6px';
        element.style.background = '#2a3942';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = 'white';

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '-6px';
        closeBtn.style.right = '-6px';
        closeBtn.style.background = '#ff3b30';
        closeBtn.style.color = 'white';
        closeBtn.style.width = '18px';
        closeBtn.style.height = '18px';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.fontSize = '12px';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.style.cursor = 'pointer';

        closeBtn.onclick = function() {
            wrapper.remove();
            if(previewList.children.length === 0) {
                previewBar.style.display = 'none';
                document.getElementById('media-input').value = '';
            }
        };

        wrapper.appendChild(element);
        wrapper.appendChild(closeBtn);
        previewList.appendChild(wrapper);
    });
}

function removeMediaPreview() {
    const bar = document.getElementById('media-preview-bar');
    const list = document.getElementById('media-preview-list');
    const input = document.getElementById('media-input');
    if(bar) bar.style.display = 'none';
    if(list) list.innerHTML = '';
    if(input) input.value = '';
}

function handleSendAction() {
    const mediaInput = document.getElementById('media-input');
    const file = mediaInput.files[0];
    if(file) sendMedia();
    else sendMessage();
}

/*
|--------------------------------------------------------------------------
| ATTACH MENU / HELPERS
|--------------------------------------------------------------------------
*/
function renderAttachMenu() {
    return `
        <div class="attach-item" onclick="openPhotos()">📷 Photos & videos</div>
        <div class="attach-item" onclick="openDocument()">📄 Document</div>
        <div class="attach-item" onclick="openAudio()">🎤 Audio</div>
        <div class="attach-item">📞 Contact</div>
        <div class="attach-item">📊 Poll</div>
        <div class="attach-item">📅 Event</div>
    `;
}

function toggleAttachMenu() {
    const menu = document.getElementById('attach-menu');
    if(!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', function(e){
    const menu = document.getElementById('attach-menu');
    const button = document.getElementById('attach-button');
    if(!menu || !button) return;
    if(!menu.contains(e.target) && !button.contains(e.target)) menu.style.display = 'none';
});

function openPhotos() {
    const input = document.getElementById('media-input');
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.click();
}

function openAudio() {
    const input = document.getElementById('media-input');
    input.accept = "audio/*";
    input.multiple = true;
    input.click();
}

function openDocument() {
    const input = document.getElementById('media-input');
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt";
    input.click();
}

function getClockIcon() {
    return `
    <svg viewBox="0 0 24 24" width="14" height="14" style="margin-left:3px;vertical-align:middle;opacity:0.7;">
        <path fill="currentColor" d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm.75 5.5v5.19l4.22 2.51-.75 1.23-4.97-2.96V7.25Z"/>
    </svg>
    `;
}


/* ---------------------------------------
   INSERT PIN SYSTEM MESSAGE BY TIME
--------------------------------------- */

function insertSystemMessageByTime(sys, container){

    const pinTime = parseInt(sys.dataset.time);

    let inserted = false;

    container.querySelectorAll('.msg').forEach(msg => {

        const msgTimeAttr = msg.getAttribute('data-created-at');
        if(!msgTimeAttr) return;

        const msgTime = new Date(msgTimeAttr).getTime();

        if(pinTime < msgTime && !inserted){
            container.insertBefore(sys, msg);
            inserted = true;
        }

    });

    if(!inserted){
        container.appendChild(sys);
    }

}


/*
|--------------------------------------------------------------------------
| INIT (RESTORE STATE)
|--------------------------------------------------------------------------
*/



document.addEventListener('DOMContentLoaded', function(){

    // ⭐ DO NOT reset chat container on starred page
    if(window.APP_PAGE === 'starred'){
        return;
    }

    localStorage.removeItem('currentChatId');
    localStorage.removeItem('currentChatUserId');

    window.currentChatId = null;
    window.currentOtherUserId = null;

    const container = document.getElementById('chat-container');
    if(container){
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
// ✅ ENTER TO SEND (Dynamic Safe + No Duplicate + Media Safe)
document.addEventListener('keydown', function(e){

    // Only target message input
    if(!e.target || e.target.id !== 'message-input') return;

    // Only Enter key
    if(e.key !== 'Enter') return;

    // Allow Shift + Enter for newline
    if(e.shiftKey) return;

    e.preventDefault();

    const input = e.target;

    // Prevent rapid duplicate send
    if(input.dataset.sending === "1") return;
    input.dataset.sending = "1";

    handleSendAction();

    setTimeout(() => {
        input.dataset.sending = "0";
    }, 300);

});

document.addEventListener('input', function(e){
    if(e.target.id === 'message-input'){
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    }
});

