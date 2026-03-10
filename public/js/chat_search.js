document.addEventListener('DOMContentLoaded', function(){

const input = document.getElementById('chat-search-input');
const resultsBox = document.getElementById('chat-search-results');

if(!input) return;
resultsBox.style.display = 'none';
let timer = null;

input.addEventListener('input', function(){

    const q = this.value.trim();

    if(timer) clearTimeout(timer);

const chatList = document.querySelector('.chat-list');
if(q.length === 0){

    resultsBox.innerHTML = '';
    resultsBox.style.display = 'none';   // ⭐ ADD

    if(chatList){
        chatList.style.display = 'block';
    }

    return;
}

if(chatList){
    chatList.style.display = 'none';
}
resultsBox.style.display = 'block';   // ⭐ ADD

    timer = setTimeout(function(){
fetch('/chat/search?q='+encodeURIComponent(q))
.then(res => {

    if(!res.ok){
    throw new Error("Search request failed");
    }

    return res.json();

})
.then(data => {

   renderSearchResults(data.messages, data.contacts);

})
.catch(err => {

    console.error("Search error:", err);

});

    },250);

});

function renderSearchResults(messages, contacts){

    resultsBox.innerHTML = '';

    if(messages.length === 0 && contacts.length === 0){
        resultsBox.innerHTML =
        `<div class="search-empty">No results</div>`;
        return;
    }

    // MESSAGE RESULTS
    if(messages.length){

        const title = document.createElement('div');
        title.className = 'search-section-title';
        title.innerText = 'MESSAGES';
        resultsBox.appendChild(title);

        messages.forEach(r => {

            const div = document.createElement('div');
            div.className = 'search-item';

         div.innerHTML = `
<img src="${r.photo}" class="search-img">

<div class="search-info">

<div class="search-row">
<div class="search-name">${r.name}</div>
<div class="search-date">${r.date ?? ''}</div>
</div>

<div class="search-preview">
${highlightMatch(r.preview, input.value)}
</div>

</div>
`;

      div.onclick = function(){

    const sidebarItem =
    document.querySelector(`.chat-item[data-chat-id="${r.chat_id}"]`);

    if(sidebarItem){

        // ⭐ Save message id for scroll
      window.searchTargetMessage = r.message_id || null;
window.searchTargetChat = r.chat_id;

openChat(r.chat_id, sidebarItem);
    }

    const chatList = document.querySelector('.chat-list');
    if(chatList){
        chatList.style.display = 'block';
    }

    resultsBox.innerHTML = '';
    input.value = '';
};

            resultsBox.appendChild(div);

        });

    }

    // CONTACT RESULTS
    if(contacts.length){

        const title = document.createElement('div');
        title.className = 'search-section-title';
        title.innerText = 'CONTACTS';
        resultsBox.appendChild(title);

        contacts.forEach(r => {

            const div = document.createElement('div');
            div.className = 'search-item';

            div.innerHTML = `
                <img src="${r.photo}" class="search-img">

                <div class="search-info">
                    <div class="search-name">${r.name}</div>
                    <div class="search-preview">${r.preview}</div>
                </div>
            `;
div.onclick = function(){

    const sidebarItem =
    document.querySelector(`.chat-item[data-chat-id="${r.chat_id}"]`);

    if(sidebarItem){
        openChat(r.chat_id, sidebarItem);
    }

    const chatList = document.querySelector('.chat-list');
    if(chatList){
        chatList.style.display = 'block';
    }

    resultsBox.innerHTML = '';
    input.value = '';
};

            resultsBox.appendChild(div);

        });

    }

}

function escapeHtml(text){
return text
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;");
}


function highlightMatch(text, query){

    if(!text) return '';

    const safeText = escapeHtml(text);

    const regex = new RegExp(`(${query})`, 'ig');

    return safeText.replace(regex,
        '<span style="color:#25D366;font-weight:500;">$1</span>'
    );

}

});