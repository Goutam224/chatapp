document.addEventListener('contextmenu', function(e){

    const chat = e.target.closest('.chat-item');
    if(!chat) return;

    e.preventDefault();

    const old = document.getElementById('chat-context-menu');
    if(old) old.remove();

    const chatId = chat.dataset.chatId;
    const userId = chat.dataset.userId;
    const isPinned = chat.dataset.pinned == 1;

    // 🔹 check block status first
    fetch('/block/status/' + userId)
    .then(res => res.json())
    .then(status => {

        const isBlocked = status.blocked_by_me;

        const menu = document.createElement('div');
        menu.id = 'chat-context-menu';
        menu.className = 'chat-context-menu';

       menu.innerHTML = `
    <div class="cc-item" data-action="pin">
        <span class="cc-icon">📌</span>
        ${isPinned ? 'Unpin Chat' : 'Pin Chat'}
    </div>

    <div class="cc-item" data-action="clear">
        <span class="cc-icon">🗑</span>
        Clear Chat
    </div>

    <div class="cc-item" data-action="block">
        <span class="cc-icon">${isBlocked ? '🔓' : '🚫'}</span>
        ${isBlocked ? 'Unblock Contact' : 'Block Contact'}
    </div>
`;

        document.body.appendChild(menu);

        menu.style.left = e.pageX + 'px';
        menu.style.top  = e.pageY + 'px';

        menu.addEventListener('click', function(ev){

            const action = ev.target.dataset.action;

            if(action === 'pin'){
                if(isPinned){
                    PinChat.unpin(chatId);
                }else{
                    PinChat.pin(chatId);
                }
            }

            if(action === 'clear'){
                window.currentChatId = chatId;
                clearChatConfirm();
            }

      if(action === 'block'){

    const url = isBlocked ? '/unblock' : '/block';

    fetch(url,{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            user_id: userId
        })
    })
    .then(res => res.json())
    .then(() => {

        // update global block state
        window.iBlocked = !isBlocked;

        // show system message instantly if chat is open
        if(String(window.currentOtherUserId) === String(userId)){

            const msgContainer = document.getElementById('chat-messages');
            if(!msgContainer) return;

            const div = document.createElement('div');
            div.className = 'msg-system';

            if(!isBlocked){

                div.innerHTML = `
                    You blocked this contact.
                    <span onclick="unblockUser(${userId})"
                          style="color:#25D366;cursor:pointer;margin-left:6px;">
                        Tap to unblock
                    </span>
                `;

            }else{

    // remove only the "Tap to unblock" span
    const lastSystem = document.querySelector(
        '#chat-messages .msg-system:last-child span'
    );

    if(lastSystem){
        lastSystem.remove();
    }

    div.innerText = 'You unblocked this contact.';

}

            msgContainer.appendChild(div);
            msgContainer.scrollTop = msgContainer.scrollHeight;

        }

    });

}

            menu.remove();

        });

    });

});


document.addEventListener('click', function(){

    const menu = document.getElementById('chat-context-menu');
    if(menu) menu.remove();

});

