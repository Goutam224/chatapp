document.addEventListener('contextmenu',function(e){

    const chat = e.target.closest('.chat-item');

    if(!chat) return;

    e.preventDefault();

    const old = document.getElementById('chat-context-menu');

    if(old) old.remove();

    const menu = document.createElement('div');

    menu.id = 'chat-context-menu';

    menu.className = 'chat-context-menu';

    const chatId = chat.dataset.chatId;

    const isPinned = chat.dataset.pinned == 1;

menu.innerHTML = isPinned
    ? `<div onclick="PinChat.unpin(${chatId})">Unpin Chat</div>`
    : `<div onclick="PinChat.pin(${chatId})">Pin Chat</div>`;

    document.body.appendChild(menu);

    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';

});

document.addEventListener('click',function(){

    const menu = document.getElementById('chat-context-menu');

    if(menu) menu.remove();

});