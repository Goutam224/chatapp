window.clearChatConfirm = function(){

if(!window.currentChatId) return;

const modal = document.getElementById('clear-chat-modal');

if(!modal) return;

modal.classList.add('show');

}


/* cancel */

document.addEventListener('click',function(e){

if(e.target && e.target.id === 'cc-cancel'){

const modal = document.getElementById('clear-chat-modal');

if(modal) modal.classList.remove('show');

}

});


/* confirm */

document.addEventListener('click',function(e){

if(e.target && e.target.id === 'cc-confirm'){

const modal = document.getElementById('clear-chat-modal');

if(modal) modal.classList.remove('show');

fetch('/chat/clear',{
method:'POST',
headers:{
'Content-Type':'application/json',
'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
},
body: JSON.stringify({
chat_id: window.currentChatId
})
})
.then(res=>res.json())
.then(res=>{

if(!res.success) return;

const container = document.getElementById('chat-messages');

if(container){
container.innerHTML='';
}

const pinned = document.getElementById('pinned-bar');

if(pinned){
pinned.style.display='none';
}

const chatItem = document.querySelector(
`.chat-item[data-chat-id="${window.currentChatId}"]`
);

if(chatItem){

const preview = chatItem.querySelector('.chat-last');
const time = chatItem.querySelector('.chat-time');

if(preview) preview.innerHTML='';
if(time) time.innerHTML='';

}

});

}

});


/* click outside */

document.addEventListener('click',function(e){

const modal = document.getElementById('clear-chat-modal');

if(!modal) return;

if(e.target === modal){
modal.classList.remove('show');
}

});