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

// ✅ Cache Audio objects so we never re-create them on tab switch
audioObjects: {},

open: function()
{
    const userId =
        document.getElementById('chat-user-name')
            .getAttribute('data-user-id');

    if(!userId) return;

    // ✅ FIX 1: Fire BOTH requests in parallel — not sequential
    Promise.all([
        fetch('/user/profile/' + userId).then(r => r.json()),
        fetch('/block/status/' + userId).then(r => r.json())
    ])
    .then(([user, status]) => {

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

        const countEl = document.getElementById('shared-count');
        if(countEl){
            countEl.innerText = user.shared_count ?? 0;
        }

        // ✅ FIX 2: Block button fills instantly (both arrived together)
        const blockBtn = document.getElementById('blockBtn');
        blockBtn.dataset.userId = user.id;

        if(status.blocked_by_me){
            blockBtn.innerText = 'Unblock Contact';
            blockBtn.dataset.blocked = "1";
        } else {
            blockBtn.innerText = 'Block Contact';
            blockBtn.dataset.blocked = "0";
        }

        // Reset cache when opening a different profile
        if(this.lastUserId !== user.id){
            this.cache = { media: null, docs: null, audio: null, links: null };
            this.audioObjects = {};
            this.lastUserId = user.id;
        }

        this.currentType = 'media';
        this.offset = 0;
        this.hasMore = true;
        this.loading = false;

        const container = document.getElementById('shared-container');
        if(container){
            container.innerHTML = '';
            container.onscroll = null;
        }

        document.getElementById('profile-panel').classList.add('open');
    });
},

loadShared: function(userId, reset = false)
{
    if(this.loading || (!this.hasMore && !reset)) return;

    if(reset){
        this.offset = 0;
        this.hasMore = true;
        document.getElementById('shared-container').innerHTML = '';
    }

    if(!document.getElementById('shared-container')) return;

    // ✅ FIX 3: Serve from cache instantly — no re-fetch, no re-render
    if(!reset && this.cache[this.currentType]){
        document.getElementById('shared-container').innerHTML =
            this.cache[this.currentType];
        // Rebind audio if needed (uses cached Audio objects)
        if(this.currentType === 'audio'){
            this._rebindAudio();
        }
        return;
    }

    this.loading = true;

    if(this.requestController){
        this.requestController.abort();
    }

    this.requestController = new AbortController();

    fetch(`/user/shared/${userId}?type=${this.currentType}&offset=${this.offset}`, {
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

                if(isMine){
                    const img = div.querySelector('.grid-thumb');
                    const overlay = div.querySelector('.grid-download-overlay');
                    if(img) img.classList.remove('blurred');
                    if(overlay) overlay.remove();
                } else {
                    const img = div.querySelector('.grid-thumb');
                    if(img) img.classList.add('blurred');
                    divMap[msg.id] = div;
                }

                grid.appendChild(div);
            });

            // ✅ FIX 4: Batch download check — unchanged, already optimal
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
            data.items.forEach(msg => {
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
                            const msgEl = document.querySelector(`[data-id="${msg.id}"]`);
                            if(!msgEl) return;
                            const container = document.getElementById('chat-messages');
                            if(container){
                                container.scrollTo({ top: msgEl.offsetTop - 80, behavior: 'smooth' });
                                msgEl.style.transition = 'background 0.3s ease';
                                msgEl.style.background = 'rgba(37,211,102,0.2)';
                                setTimeout(() => { msgEl.style.background = ''; }, 1500);
                            }
                        }, 250);
                    };
                }

                container.appendChild(div);
            });
        }

        if(this.currentType === 'audio'){

            function formatTime(sec){
                const m = Math.floor(sec / 60);
                const s = Math.floor(sec % 60);
                return `${m}:${s < 10 ? '0'+s : s}`;
            }

            if(!window.profileAudio){
                window.profileAudio = null;
                window.currentAudioDiv = null;
            }

            data.items.forEach(msg => {
                const isMine = msg.sender_id == window.AUTH_USER_ID;
                const div = document.createElement('div');

                if(isMine || msg.downloaded){

                    div.className = 'audio-item';
                    div.dataset.id = msg.id;

                    div.innerHTML = `
                        <div class="audio-play">▶</div>
                        <div class="audio-info">
                            <div class="audio-name">${msg.media.file_name}</div>
                            <div class="audio-time">0:00</div>
                            <div class="audio-progress">
                                <div class="audio-progress-bar"></div>
                            </div>
                        </div>
                    `;

                    // ✅ FIX 5: Reuse cached Audio object — don't create a new one each time
                    let audio = ProfilePanel.audioObjects[msg.id];
                    if(!audio){
                        audio = new Audio(`/media/${msg.id}`);
                        ProfilePanel.audioObjects[msg.id] = audio;
                    }

                    const playBtn = div.querySelector('.audio-play');
                    const timeEl = div.querySelector('.audio-time');
                    const bar = div.querySelector('.audio-progress-bar');
                    const progressContainer = div.querySelector('.audio-progress');

                    // Restore duration if already loaded
                    if(audio.duration && !isNaN(audio.duration)){
                        timeEl.innerText = formatTime(audio.duration);
                    }

                    progressContainer.onclick = function(e){
                        if(!audio.duration) return;
                        const rect = progressContainer.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        audio.currentTime = percent * audio.duration;
                        if(!audio.paused) audio.play();
                    };

                    audio.onloadedmetadata = () => {
                        timeEl.innerText = formatTime(audio.duration);
                    };

                    playBtn.onclick = function(){
                        if(window.profileAudio && window.profileAudio !== audio){
                            window.profileAudio.pause();
                            if(window.currentAudioDiv){
                                window.currentAudioDiv.classList.remove('playing');
                                window.currentAudioDiv.querySelector('.audio-play').innerText = '▶';
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

                    audio.ontimeupdate = () => {
                        const percent = (audio.currentTime / audio.duration) * 100;
                        bar.style.width = percent + '%';
                        timeEl.innerText = formatTime(audio.currentTime);
                    };

                    audio.onended = () => {
                        bar.style.width = '0%';
                        playBtn.innerText = '▶';
                        div.classList.remove('playing');
                        timeEl.innerText = formatTime(audio.duration);
                    };

                } else {

                    div.style.opacity = '0.6';
                    div.style.cursor = 'pointer';
                    div.innerHTML = `🔒 🎵 ${msg.media.file_name}`;
                    div.onclick = function(){
                        ProfilePanel.close();
                        setTimeout(function(){
                            const msgEl = document.querySelector(`[data-id="${msg.id}"]`);
                            if(!msgEl) return;
                            const container = document.getElementById('chat-messages');
                            if(container){
                                container.scrollTo({ top: msgEl.offsetTop - 80, behavior: 'smooth' });
                                msgEl.style.transition = 'background 0.3s ease';
                                msgEl.style.background = 'rgba(37,211,102,0.2)';
                                setTimeout(() => { msgEl.style.background = ''; }, 1500);
                            }
                        }, 250);
                    };
                }

                container.appendChild(div);
            });
        }

        if(this.currentType === 'links'){
            data.items.forEach(msg => {
                const div = document.createElement('div');
                div.innerHTML = msg.message;
                container.appendChild(div);
            });
        }

        this.cache[this.currentType] =
            document.getElementById('shared-container').innerHTML || '';

        this.offset += data.items.length;
        this.hasMore = data.has_more;
        this.loading = false;
    })
    .catch(err => {
        if(err.name === "AbortError") return;
        console.error("ProfilePanel load error:", err);
        this.loading = false;
    });
},

// ✅ FIX 6: Rebind audio from cache using stored Audio objects (instant, no re-fetch)
_rebindAudio: function()
{
    function formatTime(sec){
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    }

    const container = document.getElementById('shared-container');
    container.querySelectorAll('.audio-item').forEach(div => {
        const id = div.dataset.id;
        if(!id) return;

        const audio = ProfilePanel.audioObjects[id];
        if(!audio) return;

        const playBtn = div.querySelector('.audio-play');
        const bar = div.querySelector('.audio-progress-bar');
        const timeEl = div.querySelector('.audio-time');
        const progressContainer = div.querySelector('.audio-progress');

        // Restore live progress if currently playing
        if(!isNaN(audio.duration) && audio.duration > 0){
            const percent = (audio.currentTime / audio.duration) * 100;
            bar.style.width = percent + '%';
            timeEl.innerText = formatTime(audio.currentTime || audio.duration);
        }

        if(!audio.paused){
            playBtn.innerText = '⏸';
            div.classList.add('playing');
            window.profileAudio = audio;
            window.currentAudioDiv = div;
        }

        progressContainer.onclick = function(e){
            if(!audio.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audio.currentTime = percent * audio.duration;
        };

        playBtn.onclick = function(){
            if(window.profileAudio && window.profileAudio !== audio){
                window.profileAudio.pause();
                if(window.currentAudioDiv){
                    window.currentAudioDiv.classList.remove('playing');
                    window.currentAudioDiv.querySelector('.audio-play').innerText = '▶';
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

        audio.ontimeupdate = () => {
            const percent = (audio.currentTime / audio.duration) * 100;
            bar.style.width = percent + '%';
            timeEl.innerText = formatTime(audio.currentTime);
        };

        audio.onended = () => {
            bar.style.width = '0%';
            playBtn.innerText = '▶';
            div.classList.remove('playing');
            timeEl.innerText = formatTime(audio.duration);
        };
    });
},

openSharedOverview: function()
{
    const userId = document.getElementById('blockBtn').dataset.userId;

    document.getElementById('shared-screen').classList.add('active');

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-type="media"]').classList.add('active');

    const container = document.getElementById('shared-container');

    // ✅ FIX: If media cache exists, serve instantly — no reset, no re-fetch
    if(this.cache['media']){
        this.currentType = 'media';
        container.innerHTML = this.cache['media'];
        container.onscroll = () => {
            if(ProfilePanel.loading || !ProfilePanel.hasMore) return;
            if(container.scrollTop + container.clientHeight >= container.scrollHeight - 50){
                ProfilePanel.loadShared(userId);
            }
        };
        return;
    }

    // First time open — load fresh
    this.currentType = 'media';
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;
    container.innerHTML = '';

    this.loadShared(userId, true);

    container.onscroll = () => {
        if(ProfilePanel.loading || !ProfilePanel.hasMore) return;
        if(container.scrollTop + container.clientHeight >= container.scrollHeight - 50){
            ProfilePanel.loadShared(userId);
        }
    };
},

closeShared: function()
{
    document.getElementById('shared-screen').classList.remove('active');
},

close: function()
{
    document.getElementById('profile-panel').classList.remove('open');
    const shared = document.getElementById('shared-screen');
    if(shared) shared.classList.remove('active');
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
        .then(() => {
            window.iBlocked = !isBlocked;
            ProfilePanel.close();

            const msgContainer = document.getElementById('chat-messages');
            if(!msgContainer) return;

            const lastSystem = msgContainer.querySelector('.msg-system:last-child');
            if(lastSystem && lastSystem.innerText.includes(
                isBlocked ? 'You unblocked this contact.' : 'You blocked this contact.'
            )) return;

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

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        const type = e.target.dataset.type;
        if(ProfilePanel.currentType === type) return;

        const userId = document.getElementById('blockBtn').dataset.userId;
        ProfilePanel.currentType = type;

        const cached = ProfilePanel.cache[type];

        if(cached){
            const container = document.getElementById('shared-container');
            container.innerHTML = cached;

            // ✅ FIX 7: Audio rebind uses cached Audio objects — instant, no re-fetch
            if(type === 'audio'){
                ProfilePanel._rebindAudio();
            }

            return;
        }

        ProfilePanel.offset = 0;
        ProfilePanel.hasMore = true;
        ProfilePanel.loading = false;

        ProfilePanel.loadShared(userId, true);

        const container = document.getElementById('shared-container');
        container.onscroll = null;
        container.onscroll = () => {
            if(ProfilePanel.loading) return;
            if(container.scrollTop + container.clientHeight >= container.scrollHeight - 50){
                ProfilePanel.loadShared(userId);
            }
        };
    }
});