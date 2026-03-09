/*
|--------------------------------------------------------------------------
| PIN MESSAGE
|--------------------------------------------------------------------------
*/
window.currentPinnedIndex = 0;
window.pinnedMessages = window.pinnedMessages || [];
window.pinMessage = function(messageId){

fetch('/chat/pin-message',{
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

if(!res.success){

    if(res.limit){
        showPinLimitModal(res.oldest_id, messageId);
    }

    return;
}

// update dataset
const msg = document.querySelector(`[data-id="${messageId}"]`);
if(msg){
    msg.dataset.pinned = "1";

    const timeDiv = msg.querySelector('.time');
    if(timeDiv && !timeDiv.querySelector('.msg-pin')){
        const pin = document.createElement('span');
        pin.className = 'msg-pin';
        pin.innerText = '📌';
        timeDiv.prepend(pin);
    }
}

// store pin in global array
if(!window.pinnedMessages.find(p => p.id == messageId)){
    const msgEl = document.querySelector(`[data-id="${messageId}"]`);

let text = '';
let type = 'text';

if(msgEl){

    const content = msgEl.querySelector('.msg-content');

    if(content){
        text = content.innerText.trim();
    }

    if(msgEl.querySelector('img')) type = 'image';
    else if(msgEl.querySelector('video')) type = 'video';
    else if(msgEl.querySelector('audio')) type = 'audio';
    else if(msgEl.querySelector('.document')) type = 'file';
}

window.pinnedMessages.push({
    id: messageId,
    message: text,
    type: type
});
}

// // system notice
 insertPinSystemMessage();

// update pinned bar
renderPinnedBar(window.pinnedMessages);

});

}


/*
|--------------------------------------------------------------------------
| INSERT SYSTEM MESSAGE
|--------------------------------------------------------------------------
*/
window.insertPinSystemMessage = function(){

    const container = document.querySelector('#chat-messages');
    if(!container) return;

    const div = document.createElement('div');
    div.className = 'msg-system pin-system-message';
    div.innerText = 'You pinned a message';

    div.dataset.time = Date.now();

    if(typeof insertSystemMessageByTime === "function"){
        insertSystemMessageByTime(div, container);
    }else{
        container.appendChild(div);
    }

}

window.renderPinnedBar = function(pins){

    const bar = document.getElementById('pinned-bar');
    if(!bar) return;

    window.pinnedMessages = pins;

    if(!pins.length){
        bar.style.display = 'none';
        return;
    }

    const pin = pins[window.currentPinnedIndex];

  let previewText = '';
let mediaIcon = '';

/* TEXT */
if(pin.message){
    previewText = pin.message.substring(0,60);
}

/* IMAGE */
if(pin.type === 'image'){
    mediaIcon = '📷';
    previewText = 'Photo';
}

/* VIDEO */
else if(pin.type === 'video'){
    mediaIcon = '🎥';
    previewText = 'Video';
}

/* AUDIO */
else if(pin.type === 'audio'){
    mediaIcon = '🎵';
    previewText = 'Audio';
}

/* DOCUMENT */
else if(pin.type === 'file'){
    mediaIcon = '📄';
    previewText = 'Document';
}

    bar.style.display = 'flex';
bar.innerHTML = `
<div class="pin-slide">

    <div class="pin-progress">
        ${renderPinLines(pins.length, window.currentPinnedIndex)}
    </div>

    <div class="pinned-left">

        <span class="pin-icon">📌</span>

        <span class="pin-media-icon">${mediaIcon}</span>

        <span class="pin-text">${previewText || 'Pinned message'}</span>

    </div>

    <div class="pinned-right">

        ${pins.length > 1 ? `<span class="pin-count">${pins.length}</span>` : ''}

        <span class="pin-menu-arrow">▾</span>

    </div>

</div>
`;

    /* CLICK BAR → NEXT PIN */
bar.onclick = function(e){

    const arrow = e.target.closest('.pin-menu-arrow');

    // If arrow clicked → open menu
    if(arrow){
        e.stopPropagation();
        openPinMenu(pin);
        return;
    }

    if(bar.dataset.locked === "1") return;

    bar.dataset.locked = "1";

    const nextIndex =
        (window.currentPinnedIndex + 1) % pins.length;

    window.currentPinnedIndex = nextIndex;

    const nextPin = pins[nextIndex];

    requestAnimationFrame(()=>{

        renderPinnedBar(pins);

        scrollToPinnedMessage(nextPin.id);

        setTimeout(()=>{
            bar.dataset.locked = "0";
        },120);

    });

};

};
window.scrollToPinnedMessage = function(messageId){

    const el = document.querySelector(`[data-id="${messageId}"]`);
    if(!el) return;

    el.scrollIntoView({
        behavior:'smooth',
        block:'center'
    });

   el.style.transition = 'box-shadow 0.2s';
el.style.boxShadow = '0 0 0 3px #25D366';

    setTimeout(()=>{
        el.style.boxShadow = '';
    },2000);

};


window.unpinMessage = function(messageId){

    fetch('/chat/unpin-message',{

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
    msg.dataset.pinned = "0";

    const pin = msg.querySelector('.msg-pin');
    if(pin) pin.remove();
}

// remove from global list
window.pinnedMessages = window.pinnedMessages.filter(p => p.id != messageId);

// update bar
if(window.pinnedMessages.length){
    renderPinnedBar(window.pinnedMessages);
}else{
    const bar = document.getElementById('pinned-bar');
    if(bar) bar.style.display='none';
}

});

};

window.openPinMenu = function(pin){

    const old = document.getElementById('pin-context-menu');
    if(old) old.remove();

    const menu = document.createElement('div');
    menu.id = 'pin-context-menu';

 menu.innerHTML = `
<div class="pin-menu-item" data-action="unpin">
📌 Unpin
</div>

<div class="pin-menu-item" data-action="goto">
➜ Go to message
</div>
`;

    document.body.appendChild(menu);
menu.addEventListener('click', e => e.stopPropagation());
    menu.addEventListener('click', function(e){

const item = e.target.closest('.pin-menu-item');
if(!item) return;

const action = item.dataset.action;

if(action === 'unpin'){
    unpinMessage(pin.id);
}

if(action === 'goto'){
    scrollToPinnedMessage(pin.id);
}

menu.remove();

});
    const bar = document.getElementById('pinned-bar');
    const rect = bar.getBoundingClientRect();

    menu.style.left = rect.right - 160 + 'px';
    menu.style.top = rect.bottom + 'px';

    setTimeout(()=>{
        document.addEventListener('click', function closeMenu(e){

            if(!menu.contains(e.target)){
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }

        });
    },100);

};

window.renderPinLines = function(total,current){

let html='';

for(let i=0;i<total;i++){

html += `
<span class="pin-line ${i===current?'active':''}"></span>
`;

}

return html;

};

window.showPinLimitModal = function(oldestId,newId){

    const modal = document.createElement('div');
    modal.id = 'pin-limit-modal';

    modal.innerHTML = `
    <div class="pin-limit-box">

        <div class="pin-limit-title">
            Pin limit reached
        </div>

        <div class="pin-limit-text">
            You can only pin 3 messages in this chat.
        </div>

        <div class="pin-limit-text2">
            Remove an existing pin or replace the oldest one.
        </div>

        <div class="pin-limit-actions">

            <button class="pin-btn cancel-btn">
                Cancel
            </button>

            <button class="pin-btn replace-btn">
                Replace oldest
            </button>

        </div>

    </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();

    modal.querySelector('.cancel-btn').onclick = close;

    modal.querySelector('.replace-btn').onclick = () => {

        close();

        unpinMessage(oldestId);

        setTimeout(()=>{
            pinMessage(newId);
        },180);

    };

    // click outside
    modal.onclick = function(e){
        if(e.target.id === 'pin-limit-modal'){
            close();
        }
    };

    // ESC close
    document.addEventListener('keydown', function esc(e){
        if(e.key === 'Escape'){
            close();
            document.removeEventListener('keydown',esc);
        }
    });

}