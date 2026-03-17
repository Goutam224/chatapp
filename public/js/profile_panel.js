window.ProfilePanel = {
currentType: 'media',
offset: 0,
loading: false,
hasMore: true,
requestController: null,
cache: {
    media: null,
    docs: null,
    audio: null,
    links: null
},

open: function()
{
    const userId =
        document.getElementById('chat-user-name')
            .getAttribute('data-user-id');

    if(!userId) return;

    fetch('/user/profile/' + userId)
    .then(res => res.json())
    .then(user => {

        document.getElementById('profile-photo').src =
            user.profile_photo ?? '/images/default-avatar.png';

        document.getElementById('profile-name').innerText =
            user.name;

        document.getElementById('profile-phone').innerText =
            user.phone;

        document.getElementById('profile-about').innerText =
            user.about ?? '';

        document.getElementById('profile-last-seen').innerText =
            user.last_seen ?? '';
// ✅ SET SHARED COUNT
const countEl = document.getElementById('shared-count');
if(countEl){
    countEl.innerText = user.shared_count ?? 0;
}
        // ==============================
        // ✅ BLOCK BUTTON LOGIC START
        // ==============================

        const blockBtn = document.getElementById('blockBtn');

        blockBtn.dataset.userId = user.id;

        fetch('/block/status/' + user.id)
        .then(res => res.json())
        .then(status => {

            if(status.blocked_by_me){
                blockBtn.innerText = 'Unblock Contact';
                blockBtn.dataset.blocked = "1";
            } else {
                blockBtn.innerText = 'Block Contact';
                blockBtn.dataset.blocked = "0";
            }

        });
        // reset cache when opening new profile
if(this.lastUserId !== user.id){

    this.cache = {
        media: null,
        docs: null,
        audio: null,
        links: null
    };

    this.lastUserId = user.id;
}
// Reset shared section but do NOT load yet
this.currentType = 'media';
this.offset = 0;
this.hasMore = true;
this.loading = false;

const container = document.getElementById('shared-container');
if(container){
    container.innerHTML = '';
    container.onscroll = null;
}
        // ==============================
        // ✅ BLOCK BUTTON LOGIC END
        // ==============================

        document.getElementById('profile-panel')
            .classList.add('open');

    });
},loadShared: function(userId, reset = false)
{
    if(this.loading || (!this.hasMore && !reset)) return;

    if(reset){
        this.offset = 0;
        this.hasMore = true;
        document.getElementById('shared-container').innerHTML = '';
    }

   if(!document.getElementById('shared-container')) return;
// instant render from cache
if(!reset && this.cache[this.currentType]){
    document.getElementById('shared-container').innerHTML =
        this.cache[this.currentType];
    return;
}

this.loading = true;

// cancel previous request
if(this.requestController){
    this.requestController.abort();
}

this.requestController = new AbortController();
fetch(`/user/shared/${userId}?type=${this.currentType}&offset=${this.offset}`,{
    signal: this.requestController.signal
})
.then(res => res.json())
.then(data => {
if(!data || !data.items) return;

        const container = document.getElementById('shared-container');

        if(this.currentType === 'media'){
            let grid = container.querySelector('.media-grid');
            if(!grid){
                grid = document.createElement('div');
                grid.className = 'media-grid';
                container.appendChild(grid);
            }

     // ✅ Render all items first
const divMap = {};

data.items.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'media-thumb';

  const thumb = msg.media.thumbnail_path
    ? `/media/thumb/${msg.id}`
    : '';

    const isMine = msg.sender_id == window.AUTH_USER_ID;

    div.innerHTML = `
        <div class="media-grid-item"
             data-media-view
             data-url="/media/${msg.id}"
             data-type="${msg.type}"
             data-sender="${msg.sender_id}"
             data-file-size="${msg.media.file_size}"
           data-thumb="${msg.id}">
<img src="${thumb}" class="grid-thumb" loading="lazy">
            ${!isMine ? `<div class="grid-download-overlay">⬇</div>` : ``}
        </div>
    `;

    // sender → clear immediately, no need for status check
    if(isMine){
        const img = div.querySelector('.grid-thumb');
        const overlay = div.querySelector('.grid-download-overlay');
        if(img) img.classList.remove('blurred');
        if(overlay) overlay.remove();
    } else {
        // blur by default until batch check confirms
        const img = div.querySelector('.grid-thumb');
        if(img) img.classList.add('blurred');
        divMap[msg.id] = div;
    }

    grid.appendChild(div);
});

// ✅ ONE batch request for all receiver items
const receiverIds = Object.keys(divMap);
if(receiverIds.length > 0){
    $.ajax({
        url: '/download/status/batch',
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        data: JSON.stringify({ ids: receiverIds }),
        success: function(statuses){
            receiverIds.forEach(id => {
                const div = divMap[id];
                if(!div) return;
                const img = div.querySelector('.grid-thumb');
const overlay = div.querySelector('.grid-download-overlay');
if(!img) return;
                const status = statuses[id];
                if(status && status.completed == 1){
                    if(img) img.classList.remove('blurred');
                    if(overlay) overlay.remove();
                }
            });
        }
    });
}
        }

       if(this.currentType === 'docs'){
    data.items.forEach(msg=>{

        const div = document.createElement('div');
        const isMine = msg.sender_id == window.AUTH_USER_ID;

        if(isMine || msg.downloaded){

            div.style.cursor = 'pointer';
            div.innerHTML = `📄 ${msg.media.file_name}`;

            div.onclick = function(){
                window.open(`/media/${msg.id}`, '_blank');
            };

      } else {

    div.style.opacity = '0.6';
    div.style.cursor = 'pointer';
    div.innerHTML = `🔒 📄 ${msg.media.file_name}`;

    div.onclick = function(){

        ProfilePanel.close();

        setTimeout(function(){

            const msgEl = document.querySelector(
                `[data-id="${msg.id}"]`
            );

            if(!msgEl) return;

            const container =
                document.getElementById('chat-messages');

            if(container){

                container.scrollTo({
                    top: msgEl.offsetTop - 80,
                    behavior: 'smooth'
                });

                msgEl.style.transition = 'background 0.3s ease';
                msgEl.style.background =
                    'rgba(37,211,102,0.2)';

                setTimeout(()=>{
                    msgEl.style.background = '';
                },1500);
            }

        },250);
    };
}

        container.appendChild(div);
    });
}

   if(this.currentType === 'audio'){

    if(!window.profileAudio){
        window.profileAudio = null;
        window.currentAudioDiv = null;
    }

    function formatTime(sec){
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    }

    data.items.forEach(msg=>{

        const isMine = msg.sender_id == window.AUTH_USER_ID;
        const div = document.createElement('div');

        if(isMine || msg.downloaded){

     div.className = 'audio-item';
div.dataset.id = msg.id;
const savedDuration = div.dataset?.duration ?? "0:00";

div.innerHTML = `
    <div class="audio-play">▶</div>
    <div class="audio-info">
        <div class="audio-name">${msg.media.file_name}</div>
        <div class="audio-time">${savedDuration}</div>
                    <div class="audio-progress">
                        <div class="audio-progress-bar"></div>
                    </div>
                </div>
            `;

            const playBtn = div.querySelector('.audio-play');
            const timeEl = div.querySelector('.audio-time');
            const bar = div.querySelector('.audio-progress-bar');
const progressContainer = div.querySelector('.audio-progress');

// ✅ Seek on progress click
progressContainer.onclick = function(e){

    if(!audio.duration) return;

    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    const percent = clickX / width;
    audio.currentTime = percent * audio.duration;

    // If already playing → continue playing
    if(!audio.paused){
        audio.play();
    }
};
if(window.profileAudio){
    window.profileAudio.pause();
}
            const audio = new Audio(`/media/${msg.id}`);

audio.addEventListener('loadedmetadata', ()=>{

    const duration = formatTime(audio.duration);
    timeEl.innerText = duration;

    // update cached HTML so next tab switch keeps duration
    if(window.ProfilePanel){
        const container = document.getElementById('shared-container');
        if(container){
            ProfilePanel.cache['audio'] = container.innerHTML;
        }
    }

});

            playBtn.onclick = function(){

                // Stop previous audio
                if(window.profileAudio && window.profileAudio !== audio){
                    window.profileAudio.pause();
                    if(window.currentAudioDiv){
                        window.currentAudioDiv.classList.remove('playing');
                        window.currentAudioDiv
                            .querySelector('.audio-play')
                            .innerText = '▶';
                    }
                }

                if(audio.paused){

                    audio.play();
                    playBtn.innerText = '⏸';
                    div.classList.add('playing');

                    window.profileAudio = audio;
                    window.currentAudioDiv = div;

                } else {

                    audio.pause();
                    playBtn.innerText = '▶';
                    div.classList.remove('playing');
                }
            };

            // Update progress
            audio.addEventListener('timeupdate', ()=>{
                const percent =
                    (audio.currentTime / audio.duration) * 100;
                bar.style.width = percent + '%';
                timeEl.innerText =
                    formatTime(audio.currentTime);
            });

            // Reset when finished
            audio.addEventListener('ended', ()=>{
                bar.style.width = '0%';
                playBtn.innerText = '▶';
                div.classList.remove('playing');
                timeEl.innerText =
                    formatTime(audio.duration);
            });

        } else {

    div.style.opacity = '0.6';
    div.style.cursor = 'pointer';
    div.innerHTML = `🔒 🎵 ${msg.media.file_name}`;

    div.onclick = function(){

        ProfilePanel.close();

        setTimeout(function(){

            const msgEl = document.querySelector(
                `[data-id="${msg.id}"]`
            );

            if(!msgEl) return;

            const container =
                document.getElementById('chat-messages');

            if(container){

                container.scrollTo({
                    top: msgEl.offsetTop - 80,
                    behavior: 'smooth'
                });

                msgEl.style.transition = 'background 0.3s ease';
                msgEl.style.background =
                    'rgba(37,211,102,0.2)';

                setTimeout(()=>{
                    msgEl.style.background = '';
                },1500);
            }

        },250);
    };
}

        container.appendChild(div);
    });
}

        if(this.currentType === 'links'){
            data.items.forEach(msg=>{
                const div = document.createElement('div');
                div.innerHTML = msg.message;
                container.appendChild(div);
            });
        }

 this.cache[this.currentType] =
    document.getElementById('shared-container').innerHTML || '';
    this.cacheAudioDurations = this.cacheAudioDurations || {};
this.offset += data.items.length;
this.hasMore = data.has_more;
this.loading = false;

})
.catch(err => {

    // ignore abort error (normal when switching tabs)
    if(err.name === "AbortError"){
        return;
    }

    console.error("ProfilePanel load error:", err);

    this.loading = false;

});
    
},
openSharedOverview: function()
{
    const userId = document.getElementById('blockBtn').dataset.userId;

    this.currentType = 'media';
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;

    const container = document.getElementById('shared-container');

    if(container){
        container.innerHTML = '';
    }

    document.getElementById('shared-screen')
        .classList.add('active');

    // Auto activate first tab
    document.querySelectorAll('.tab')
        .forEach(t => t.classList.remove('active'));

    document.querySelector('.tab[data-type="media"]')
        .classList.add('active');

    this.loadShared(userId, true);

  container.onscroll = () => {
if(ProfilePanel.loading || !ProfilePanel.hasMore) return;

    if (
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 50
    ) {
        ProfilePanel.loadShared(userId);
    }

};
},

closeShared: function()
{
    document.getElementById('shared-screen')
        .classList.remove('active');
},

    close: function()
{
    document.getElementById('profile-panel')
        .classList.remove('open');

    const shared = document.getElementById('shared-screen');
    if(shared){
        shared.classList.remove('active');
    }
},

};

document.addEventListener('click', function(e){

    if(e.target.id === 'blockBtn'){

        const userId = e.target.dataset.userId;
        const isBlocked = e.target.dataset.blocked === "1";

        const url = isBlocked ? '/unblock' : '/block';

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
               'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            },
            body: JSON.stringify({ user_id: userId })
        })
        .then(res => res.json())
 .then((res) => {

    window.iBlocked = !isBlocked;

    ProfilePanel.close();

    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;

    const lastSystem =
        msgContainer.querySelector('.msg-system:last-child');

    // ✅ Prevent manual duplicate
    if (lastSystem &&
        lastSystem.innerText.includes(
            isBlocked
                ? 'You unblocked this contact.'
                : 'You blocked this contact.'
        )
    ) {
        return;
    }

    const div = document.createElement('div');
    div.className = 'msg-system';

    if (!isBlocked) {
        div.innerHTML = `
            You blocked this contact.
            <span onclick="unblockUser(${userId})"
                  style="color:#25D366;cursor:pointer;margin-left:6px;">
                Tap to unblock
            </span>
        `;
    } else {
        div.innerText = 'You unblocked this contact.';
    }

    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;

});

    }

});
// ==============================
// ✅ TAB SWITCH SYSTEM
// ==============================

document.addEventListener('click', function(e){

    if(e.target.classList.contains('tab')){

        document.querySelectorAll('.tab')
            .forEach(t => t.classList.remove('active'));

        e.target.classList.add('active');

        const type = e.target.dataset.type;
        if(ProfilePanel.currentType === type) return;
        const userId = document.getElementById('blockBtn').dataset.userId;
ProfilePanel.currentType = type;

const cached = ProfilePanel.cache[type];

if(cached){

    const container = document.getElementById('shared-container');
    container.innerHTML = cached;

    // rebind audio players after restoring cache
    if(type === 'audio'){

        container.querySelectorAll('.audio-item').forEach(div=>{

            const playBtn = div.querySelector('.audio-play');
            const bar = div.querySelector('.audio-progress-bar');
            const timeEl = div.querySelector('.audio-time');

            const id = div.dataset.id;
            if(!id) return;

            const audio = new Audio(`/media/${id}`);

            playBtn.onclick = function(){

                if(window.profileAudio && window.profileAudio !== audio){
                    window.profileAudio.pause();
                }

                if(audio.paused){
                    audio.play();
                    playBtn.innerText = '⏸';
                    window.profileAudio = audio;
                }else{
                    audio.pause();
                    playBtn.innerText = '▶';
                }
            };

            audio.addEventListener('timeupdate', ()=>{
                const percent = (audio.currentTime / audio.duration) * 100;
                bar.style.width = percent + '%';
                timeEl.innerText =
                    Math.floor(audio.currentTime/60)+":"+
                    ("0"+Math.floor(audio.currentTime%60)).slice(-2);
            });

        });

    }

    return;
}

ProfilePanel.offset = 0;
ProfilePanel.hasMore = true;
ProfilePanel.loading = false;

ProfilePanel.loadShared(userId, true);

// Bind lazy scroll only after first click
const container = document.getElementById('shared-container');
container.onscroll = null;

container.onscroll = () => {

    if(ProfilePanel.loading) return;

    if (
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 50
    ) {
        ProfilePanel.loadShared(userId);
    }
};
    }
});

