window.PinChat = {

    pinnedChats: [],
init(){

    const modal = document.getElementById('pin-limit-modal');
    if(modal) modal.style.display = 'none';

    // ✅ Read pinned chats directly from already-rendered DOM
    // No fetch needed — server already rendered correct order
    document.querySelectorAll('.chat-item[data-pinned="1"]').forEach(item => {
        const chatId = parseInt(item.dataset.chatId);
        if(!this.pinnedChats.includes(chatId)){
            this.pinnedChats.push(chatId);
        }
        const icon = item.querySelector('.chat-pin-icon');
        if(icon) icon.style.display = 'inline';
    });

},

applyPins(){

    const chatList = document.querySelector('.chat-list');
    if(!chatList) return;

    // ✅ Only set attributes + icons, never reorder (server handles order)
    this.pinnedChats.forEach(chatId => {

        const item =
        document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

        if(!item) return;

        item.dataset.pinned = "1";

        const icon = item.querySelector('.chat-pin-icon');
        if(icon) icon.style.display = 'inline';

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
      this.showLimitModal();
            return;
        }

        const item =
document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);

if(item){

    item.dataset.pinned = "1";

    const icon = item.querySelector('.chat-pin-icon');
    if(icon) icon.style.display = 'inline';

}

   if(!this.pinnedChats.includes(parseInt(chatId))){
    this.pinnedChats.push(parseInt(chatId));
}

        this.applyPins();

        // ✅ move pinned chat to top instantly
        const chatList = document.querySelector('.chat-list');
        if(item && chatList) chatList.prepend(item);

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

    // ✅ reposition unpinned chat by last message time
    const chatList = document.querySelector('.chat-list');
    if(item && chatList){

        const itemTime = new Date(
            item.querySelector('.chat-time')?.dataset?.time || 0
        ).getTime();

        const unpinnedItems = Array.from(
            chatList.querySelectorAll('.chat-item[data-pinned="0"], .chat-item:not([data-pinned="1"])')
        ).filter(el => el !== item);

        let inserted = false;

        for(const el of unpinnedItems){
            const elTime = new Date(
                el.querySelector('.chat-time')?.dataset?.time || 0
            ).getTime();
            if(itemTime > elTime){
                chatList.insertBefore(item, el);
                inserted = true;
                break;
            }
        }

        if(!inserted) chatList.appendChild(item);
    }

},

moveToTopIfNotPinned(chatItem){

    if(!chatItem) return;

    const chatList = document.querySelector('.chat-list');
    if(!chatList) return;

    const chatId = parseInt(chatItem.dataset.chatId);

    // if this chat itself is pinned → never move
    if(this.pinnedChats.includes(chatId)) return;

   const pinnedItems = Array.from(
    chatList.querySelectorAll('.chat-item[data-pinned="1"]')
);

if(pinnedItems.length){

const lastPinned = pinnedItems[pinnedItems.length - 1];

chatItem.remove();
chatList.insertBefore(chatItem, lastPinned.nextSibling);

    }else{

        chatList.prepend(chatItem);

    }

},

showLimitModal(){

    const modal = document.getElementById('pin-limit-modal');
    if(modal) modal.style.display = 'flex';

},

closeLimitModal(){

    const modal = document.getElementById('pin-limit-modal');
    if(modal) modal.style.display = 'none';

},

};

document.addEventListener('DOMContentLoaded',function(){

    PinChat.init();

});

window.PinChat.isPinned = function(chatId){

    return this.pinnedChats.includes(parseInt(chatId));

}