document.addEventListener('contextmenu', function(e){

    // 🔥 remove old menu first
    const oldMenu = document.getElementById('custom-context-menu');
    if(oldMenu) oldMenu.remove();

    const msg = e.target.closest('.msg');
    if(!msg) return;

    e.preventDefault();

    const isPausedUpload =
        msg.dataset.uploading === "1" &&
        msg.querySelector('.resume-upload');
const isFinishedMessage = msg.dataset.id;
const menu = document.createElement('div');
menu.id = 'custom-context-menu';

    menu.style.position='absolute';
    menu.style.background='#202c33';
    menu.style.color='white';
    menu.style.padding='5px';
    menu.style.borderRadius='5px';
    menu.style.cursor='pointer';
    menu.style.zIndex='9999';

    // -----------------------------------
    // CASE 1: PAUSED UPLOAD → CANCEL ONLY
    // -----------------------------------
    if(isPausedUpload){

        const uuid = msg.dataset.uploadUuid;
if(!uuid) return;

        menu.innerHTML = `
        <div id="cancel-upload-option">Cancel Upload</div>
        `;

        menu.querySelector('#cancel-upload-option').onclick = function(){

            fetch('/upload/destroy/' + uuid,{
                method:'POST',
                headers:{
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                }
            }).then(()=>{

                msg.remove();

                const request = indexedDB.open('UploadDB',1);
                request.onsuccess = function(ev){
                    const db = ev.target.result;
                    const tx = db.transaction(['files'],'readwrite');
                    tx.objectStore('files').delete(uuid);
                };

            });

        };

    }
    // -----------------------------------
    // CASE 2: FINISHED MESSAGE → DELETE OPTIONS
    // -----------------------------------
  // -----------------------------------
// CASE 2: FINISHED MESSAGE → REPLY + DELETE OPTIONS
// -----------------------------------
else if(isFinishedMessage){

    const messageId = msg.dataset.id;
    const isMine = msg.classList.contains('msg-right');
const isPinned = msg.dataset.pinned == "1";
const isStarred = msg.dataset.starred == "1";
    // menu style improvements
    menu.style.minWidth='160px';
    menu.style.boxShadow='0 4px 20px rgba(0,0,0,0.4)';
    menu.style.fontSize='14px';

  menu.innerHTML = `
${isMine ? `
<div class="context-item" onclick="MessageInfo.open(${messageId})">
<span class="context-icon">ⓘ</span>
Message info
</div>
` : ''}


<div class="context-item" onclick="setReply(${messageId})">
<span class="context-icon">↩</span>
Reply
</div>

<div class="context-item">
<span class="context-icon">😀</span>
React
</div>

<div class="context-item">
<span class="context-icon">⬇</span>
Download
</div>

${!isPinned ? `
<div class="context-item" onclick="pinMessage(${messageId})">
<span class="context-icon">📌</span>
Pin
</div>
` : `
<div class="context-item" onclick="unpinMessage(${messageId})">
<span class="context-icon">📌</span>
Unpin
</div>

<div class="context-item" onclick="scrollToPinnedMessage(${messageId})">
<span class="context-icon">➡</span>
Go to message
</div>
`}

${isMine && !msg.querySelector('img, video, audio, .document') ? `
<div class="context-item" onclick="startEditMessage(${messageId})">
<span class="context-icon">✏</span>
Edit
</div>
` : ''}


${!isStarred ? `
<div class="context-item" onclick="starMessage(${messageId})">
<span class="context-icon">⭐</span>
Star
</div>
` : `
<div class="context-item" onclick="unstarMessage(${messageId})">
<span class="context-icon">⭐</span>
Unstar
</div>
`}

<div class="context-divider"></div>

<div class="context-item" onclick="deleteForMe(${messageId})">
<span class="context-icon">🗑</span>
Delete for Me
</div>

${isMine && canDeleteForEveryone(msg) ? `
<div class="context-item" onclick="deleteForEveryone(${messageId})">
<span class="context-icon">🗑</span>
Delete for Everyone
</div>
` : ''}

`;
}
    else{
        return; // uploading state without pause → no menu
    }

   // append first to measure size
// append first so we can measure menu size
document.body.appendChild(menu);

const menuWidth = menu.offsetWidth;
const menuHeight = menu.offsetHeight;
let posX = e.pageX || e.clientX;
let posY = e.pageY || e.clientY;

// ✅ detect sender message
const isRightMessage = msg.classList.contains('msg-right');

if(isRightMessage){
    posX = posX - menuWidth + 20;
}

// prevent right overflow
if(posX + menuWidth > window.innerWidth){
    posX = window.innerWidth - menuWidth - 10;
}

// prevent bottom overflow
if(posY + menuHeight > window.innerHeight){
    posY = window.innerHeight - menuHeight - 10;
}

// prevent left overflow
if(posX < 10){
    posX = 10;
}

// prevent top overflow
if(posY < 10){
    posY = 10;
}

menu.style.left = posX + 'px';
menu.style.top = posY + 'px';
menu.style.position = 'fixed';

});


function deleteForEveryone(id){

    $.ajax({

        url: '/message/delete/everyone/' + id,

        method: 'POST',

        credentials:'same-origin',

        headers:{
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
        },

        success: function(){
            console.log('Deleted for everyone');
        },

        error: function(err){
            console.error('Delete everyone error:', err);
        }

    });

}


function deleteForMe(id){

    $.ajax({

        url: '/message/delete/me/' + id,

        method: 'POST',

        credentials:'same-origin',

        headers:{
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
        },

        success: function(){
            console.log('Deleted for me');
        },

        error: function(err){
            console.error('Delete me error:', err);
        }

    });

}

document.addEventListener('click', function(e){

    const arrow = e.target.closest('.msg-hover-arrow');
    if(!arrow) return;

    e.stopPropagation();

    const msg = arrow.closest('.msg');
    if(!msg) return;

    const rect = arrow.getBoundingClientRect();

    const event = new MouseEvent('contextmenu',{
        bubbles:true,
        cancelable:true,
        view:window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.bottom,
        pageX: rect.left + window.scrollX,
        pageY: rect.bottom + window.scrollY
    });

    msg.dispatchEvent(event);

});
document.addEventListener('click', function(e){

    const menu = document.getElementById('custom-context-menu');

    if(!menu) return;

    // ignore arrow click
    if(e.target.closest('.msg-hover-arrow')) return;

    if(!menu.contains(e.target)){
        menu.remove();
    }

});

// close menu when clicking any menu item
document.addEventListener('click', function(e){

    const item = e.target.closest('.context-item');
    if(!item) return;

    const menu = document.getElementById('custom-context-menu');
    if(menu) menu.remove();

});

function canDeleteForEveryone(msg){

    const createdAt = msg.dataset.createdAt;
    if(!createdAt) return false;

    const msgTime = new Date(createdAt).getTime();
    const now = Date.now();

    const diffMinutes = (now - msgTime) / (1000 * 60);

    return diffMinutes <= 15;

}