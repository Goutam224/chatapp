if(window.APP_PAGE !== "starred"){

window.currentChatId = null;

document.querySelectorAll('.chat-item')
.forEach(item => {

    const chatId = item.dataset.chatId;

    ChatSystem.listenSidebar(chatId, item);
joinPresenceChannel(chatId);
});


document.addEventListener('click', e => {

    const item =
        e.target.closest('.chat-item');

    if(!item) return;

    const chatId =
        item.dataset.chatId;
const badge =
item.querySelector('.unread-count');

if(badge)
    badge.remove();

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
    fetch('/chat/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            user_id: user.id
        })
    })
    .then(res => res.json())
    .then(data => {

        if(!data.success) return;

        const chatId = data.id;

        // Hide new list
        document.getElementById('new-chat-list').style.display = 'none';
        document.querySelector('.chat-list').style.display = 'block';

        // Check if chat already exists in sidebar
        let existingItem =
            document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

        if(!existingItem){

            // Create new sidebar item dynamically
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.setAttribute('data-chat-id', chatId);
            div.setAttribute('data-user-id', user.id);

            div.innerHTML = `
                <img src="${user.profile_photo ?? '/default.png'}" class="chat-img">
                <div class="chat-info">
                    <div class="chat-name">${user.name}</div>
                    <div class="chat-last"></div>
                </div>
                <div class="chat-time"></div>
            `;

            div.onclick = function(){
                openChat(chatId, div);
            };

            document.querySelector('.chat-list').prepend(div);

            existingItem = div;
        }

        openChat(chatId, existingItem);

    });
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