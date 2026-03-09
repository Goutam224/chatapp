window.starMessage = function(messageId){

fetch('/message/star',{
method:'POST',
headers:{
'Content-Type':'application/json',
'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
},
body: JSON.stringify({
message_id: messageId
})
})
.then(res=>res.json())
.then(res=>{

if(!res.success) return;

const msg = document.querySelector(`[data-id="${messageId}"]`);

if(msg){

msg.dataset.starred="1";

const time = msg.querySelector('.time');

if(time && !time.querySelector('.star-icon')){
time.insertAdjacentHTML('afterbegin',
`<span class="star-icon">⭐</span>`);
}

}

});

}


window.unstarMessage = function(messageId){

fetch('/message/unstar',{
method:'POST',
headers:{
'Content-Type':'application/json',
'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
},
body: JSON.stringify({
message_id: messageId
})
})
.then(res=>res.json())
.then(res=>{

if(!res.success) return;

const msg = document.querySelector(`[data-id="${messageId}"]`);

if(msg){

msg.dataset.starred="0";

const star = msg.querySelector('.star-icon');
if(star) star.remove();

}

});

}

/* --------------------------------
   OPEN STARRED MESSAGES (NO REFRESH)
-------------------------------- */
window.openStarredMessages = function(){

    if(typeof ProfilePanel !== "undefined"){
        ProfilePanel.close();
    }

    const container = document.getElementById('chat-container');
    if(!container) return;

    // Show header + loading state instantly
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;background:#0b141a;">

            <div class="chat-header" style="display:flex;align-items:center;gap:12px;padding:0 16px;height:60px;background:#202c33;border-bottom:1px solid #222;">
                <button onclick="closeStarredMessages()"
                        style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0;line-height:1;">
                    ←
                </button>
                <span style="font-size:17px;font-weight:500;color:#e9edef;">Starred messages</span>
            </div>

            <div id="starred-list" style="flex:1;overflow-y:auto;padding:16px;">
                <div style="color:#8696a0;text-align:center;margin-top:60px;font-size:14px;">
                    Loading...
                </div>
            </div>

        </div>
    `;

    window.APP_PAGE = "starred";

    fetch('/starred-messages', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {

        const list = document.getElementById('starred-list');
        if(!list) return;

        if(!data.stars || data.stars.length === 0){
            list.innerHTML = `
                <div style="
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;
                    height:100%;
                    color:#8696a0;
                    font-size:14px;
                    gap:12px;
                    margin-top:80px;
                ">
                    <span style="font-size:48px;">⭐</span>
                    <span>No starred messages</span>
                </div>
            `;
            return;
        }
list.innerHTML = data.stars.map(star => {

            const msg   = star.message;
            if(!msg) return '';

            // ✅ skip deleted-for-everyone messages
            if(msg.deleted_for_everyone) return '';

            const senderName  = escapeHtml(msg.sender_name ?? 'Unknown');
            const chatName    = escapeHtml(msg.chat_name ?? senderName);
            const timeStr     = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString([], {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })
                : '';
            const dateStr     = msg.created_at
                ? formatMessageDate(msg.created_at)
                : '';

         // build message body
let bodyHtml = '';
if(msg.deleted_for_everyone){
    bodyHtml = `<i style="color:#8696a0;">This message was deleted</i>`;

} else if(msg.media){

    const media    = msg.media;
    const mediaUrl = '/media/' + msg.id;

    // normalize type: DB stores 'file' but renderer expects 'document'
    let type = (msg.type || media.file_type || '').toLowerCase();
    if(type === 'file') type = 'document';

    const fileSize = media.file_size || null;
    const fileName = media.file_name || null;

    const isMine       = msg.sender_id == window.AUTH_USER_ID;
    const isDownloaded = msg.downloaded == 1;

    if(isMine || isDownloaded){
        // ✅ sender always sees preview, receiver sees preview only if downloaded
        bodyHtml = MediaDownloader.renderPreviewFromURL(
            mediaUrl,
            type,
            fileSize,
            msg.sender_id,
            fileName
        );
    } else {
        // ✅ receiver not yet downloaded — show proper download UI
        const fakeMsg = {
            id:         msg.id,
            sender_id:  msg.sender_id,
            type:       type,
            downloaded: 0,
            media: {
                file_size:       media.file_size,
                file_name:       media.file_name,
                file_type:       type,
                thumbnail_path:  media.thumbnail_path ?? null,
            }
        };
        bodyHtml = MediaDownloader.renderDownloadUI(fakeMsg);
    }

    // caption below media if any
    if(msg.message){
        bodyHtml += `
            <div style="font-size:13px;color:#e9edef;
                        margin-top:6px;word-break:break-word;
                        padding:0 2px;">
                ${escapeHtml(msg.message)}
            </div>
        `;
    }

} else {
    bodyHtml = `<span class="starred-msg-text"
                      style="font-size:14px;color:#e9edef;
                             word-break:break-word;">
                    ${escapeHtml(msg.message ?? '')}
                </span>`;
}

           return `
    <div onclick="goToStarredMessage(${msg.chat_id}, ${msg.id})"
         data-message-id="${msg.id}"
         style="
            background:#202c33;
            border-radius:10px;
            margin-bottom:12px;
            overflow:hidden;
            cursor:pointer;
            transition:background 0.15s ease;
         "
         onmouseover="this.style.background='#2a3942'"
         onmouseout="this.style.background='#202c33'">

                    <!-- Card header: chat name + date -->
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        padding:10px 14px 6px 14px;
                        border-bottom:1px solid #2a3942;
                    ">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="font-size:13px;font-weight:500;color:#e9edef;">
                                ${chatName}
                            </span>
                            <span style="color:#8696a0;font-size:13px;">›</span>
                            <span style="font-size:12px;color:#8696a0;">
                                ${senderName}
                            </span>
                        </div>
                        <span style="font-size:12px;color:#8696a0;">${dateStr}</span>
                    </div>

                    <!-- Message bubble -->
                    <div style="padding:10px 14px 12px 14px;">

                        <div style="
                            background:#005c4b;
                            border-radius:8px;
                            padding:8px 10px 22px 10px;
                            display:inline-block;
                            max-width:100%;
                            position:relative;
                            min-width:120px;
                        ">
                            ${bodyHtml}
<div style="
    position:absolute;
    bottom:5px;
    right:8px;
    display:flex;
    align-items:center;
    gap:6px;
    font-size:11px;
    color:rgba(255,255,255,0.65);
">

    <span style="font-size:11px;">⭐</span>
    <span>${timeStr}</span>

    <span
        onclick="event.stopPropagation(); unstarFromStarredPanel(${msg.id})"
        style="
            margin-left:6px;
            cursor:pointer;
            color:#25D366;
            font-size:11px;
        ">
        Unstar
    </span>

</div>
                        </div>

                    </div>

                </div>
            `;

        }).join('');

    })
    .catch(() => {
        const list = document.getElementById('starred-list');
        if(list) list.innerHTML = `
            <div style="color:#8696a0;text-align:center;margin-top:60px;font-size:14px;">
                Failed to load starred messages.
            </div>
        `;
    });

}

window.goToStarredMessage = function(chatId, messageId){

    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if(!chatItem) return;

    closeStarredMessages();

    setTimeout(() => {
        openChat(chatId, chatItem);
        setTimeout(() => {
            const el = document.querySelector(`[data-id="${messageId}"]`);
            if(el){
                el.scrollIntoView({ behavior:'smooth', block:'center' });
                el.style.transition = 'background 0.3s ease';
                el.style.background = '#2a3942';
                setTimeout(() => { el.style.background = ''; }, 1500);
            }
        }, 600);
    }, 100);

}

/* --------------------------------
   CLOSE STARRED PAGE
-------------------------------- */

window.closeStarredMessages = function(){

window.APP_PAGE = "chat";

// restore last open chat
const chatId = localStorage.getItem('currentChatId');

if(chatId){

const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

if(chatItem){
    openChat(chatId, chatItem);
    return;
}

}

// fallback
const container = document.getElementById('chat-container');

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


window.unstarFromStarredPanel = function(messageId){

fetch('/message/unstar',{
method:'POST',
headers:{
'Content-Type':'application/json',
'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
},
body: JSON.stringify({
message_id: messageId
})
})
.then(res=>res.json())
.then(res=>{

if(!res.success) return;

const card = document.querySelector(
`#starred-list [data-message-id="${messageId}"]`
);

if(card){

card.style.transition='opacity 0.2s ease';
card.style.opacity='0';

setTimeout(()=>card.remove(),200);

}

});
}