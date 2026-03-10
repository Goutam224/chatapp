/*
|--------------------------------------------------------------------------
| CHAT FILTER SYSTEM
|--------------------------------------------------------------------------
*/

function updateUnreadFilterCount(){

let total = 0;

document.querySelectorAll(".chat-item").forEach(chat => {
    total += parseInt(chat.dataset.unread || 0);
});

const badge = document.getElementById("unread-count");

if(badge){
    badge.innerText = total > 0 ? total : '';
}

}


/*
|--------------------------------------------------------------------------
| FILTER CLICK
|--------------------------------------------------------------------------
*/

document.addEventListener("click", function(e){

if(!e.target.classList.contains("chat-filter")) return;

document.querySelectorAll(".chat-filter")
.forEach(btn => btn.classList.remove("active"));

e.target.classList.add("active");

const filter = e.target.dataset.filter;

document.querySelectorAll(".chat-item").forEach(chat => {

const unread = parseInt(chat.dataset.unread || 0);

if(filter === "unread"){
    chat.style.display = unread > 0 ? "flex" : "none";
}else{
    chat.style.display = "flex";
}

});

});


/*
|--------------------------------------------------------------------------
| AUTO UPDATE ON PAGE LOAD
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", function(){
    updateUnreadFilterCount();
});

window.updateUnreadFilterCount = updateUnreadFilterCount;