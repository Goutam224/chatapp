window.PinChat = {

    pinnedChats: [],

    init(){

        fetch('/chat/pinned',{
    headers:{
        'Accept':'application/json'
    }
})
        .then(res=>res.json())
        .then(data=>{

            this.pinnedChats = Array.isArray(data) ? data : [];

            this.applyPins();

        });

    },

  applyPins(){

    const chatList = document.querySelector('.chat-list');
    if(!chatList) return;

    // sort pinned chats by order stored in DB
    this.pinnedChats.forEach(chatId => {

        const item =
        document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

        if(!item) return;

        item.dataset.pinned = "1";

        const icon = item.querySelector('.chat-pin-icon');
        if(icon) icon.style.display = 'inline';

        // move pinned chats above normal chats
        chatList.insertBefore(item, chatList.firstChild);

    });

},

    pin(chatId){

    fetch('/chat/pin',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]').content
        },
        body:JSON.stringify({
            chat_id:chatId
        })
    })
    .then(res=>res.json())
    .then(res=>{

        if(!res.success){
            alert(res.message);
            return;
        }

        const item =
document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

if(item){

    item.dataset.pinned = "1";

    const icon = item.querySelector('.chat-pin-icon');
    if(icon) icon.style.display = 'inline';

}

    if(!this.pinnedChats.includes(chatId)){
    this.pinnedChats.push(chatId);
}

        this.applyPins();

    });

},

  unpin(chatId){

    fetch('/chat/unpin',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]').content
        },
        body:JSON.stringify({
            chat_id:chatId
        })
    });

    const item =
    document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

    if(item){

        item.dataset.pinned = "0";

        const icon = item.querySelector('.chat-pin-icon');
        if(icon) icon.style.display = 'none';

    }

    this.pinnedChats =
        this.pinnedChats.filter(id => id != chatId);

}
};

document.addEventListener('DOMContentLoaded',function(){

    PinChat.init();

});

window.PinChat.isPinned = function(chatId){

    return this.pinnedChats.includes(parseInt(chatId));

}