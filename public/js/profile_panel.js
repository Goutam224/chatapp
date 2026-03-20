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
// ✅ LRU: max users to keep in memory at once
maxCachedUsers: 10,
userPaneLRU: [], // tracks order of user visits
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

       // REPLACE WITH:
    // REPLACE WITH:
        const container = document.getElementById('shared-container');

        // ✅ CASE 1: Same user reopening — keep all panes intact, zero reload, zero request
        if(this.lastUserId === user.id){
            document.getElementById('profile-panel').classList.add('open');
            return;
        }

      // REPLACE WITH:
        // ✅ CASE 2: Different user — save current user's panes into DocumentFragment (live nodes)
        if(this.lastUserId && container){
            if(!this.userPaneFragments) this.userPaneFragments = {};
            if(!this.userAudioObjects) this.userAudioObjects = {};
            if(!this.userOffsets) this.userOffsets = {};
            if(!this.userHasMore) this.userHasMore = {};
            if(!this.userPaneLRU) this.userPaneLRU = [];

            // Move panes out of DOM into fragment — keeps them live, no destroy
            const fragment = document.createDocumentFragment();
            container.querySelectorAll('.tab-pane').forEach(p => fragment.appendChild(p));
            this.userPaneFragments[this.lastUserId] = fragment;
            this.userAudioObjects[this.lastUserId] = this.audioObjects;
            this.userOffsets[this.lastUserId] = this.offset;
            this.userHasMore[this.lastUserId] = this.hasMore;

            // ✅ LRU: track visit order
            this.userPaneLRU = this.userPaneLRU.filter(id => id != this.lastUserId);
            this.userPaneLRU.push(this.lastUserId);

            // ✅ LRU: evict oldest user if over limit
            if(this.userPaneLRU.length > this.maxCachedUsers){
                const evictId = this.userPaneLRU.shift(); // remove oldest
                delete this.userPaneFragments[evictId];
                delete this.userAudioObjects[evictId];
                delete this.userOffsets[evictId];
                delete this.userHasMore[evictId];
            }
        }

        // ✅ CASE 3: Previously visited user — restore their panes instantly from fragment
        if(this.userPaneFragments && this.userPaneFragments[user.id]){
            container.innerHTML = '';
            container.appendChild(this.userPaneFragments[user.id]);
            this.audioObjects = this.userAudioObjects[user.id] ?? {};
            this.offset = this.userOffsets[user.id] ?? 0;
            this.hasMore = this.userHasMore[user.id] ?? false;
            this.lastUserId = user.id;
            this.currentType = 'media';
            this.loading = false;

            // ✅ Show media pane, hide others
            container.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
            const mediaPane = container.querySelector('.tab-pane[data-type="media"]');
            if(mediaPane) mediaPane.style.display = 'block';

            // ✅ Reset tab buttons to media
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            const mediaTab = document.querySelector('.tab[data-type="media"]');
            if(mediaTab) mediaTab.classList.add('active');

            // ✅ Restore scroll listener for pagination
            container.onscroll = null;
            container.onscroll = () => {
                if(ProfilePanel.loading || !ProfilePanel.hasMore) return;
                if(container.scrollTop + container.clientHeight >= container.scrollHeight - 50){
                    ProfilePanel.loadSharedIntoPane(mediaPane, 'media', user.id);
                }
            };

            // ✅ Rebind audio events
            this.rebindAudio();

            document.getElementById('profile-panel').classList.add('open');
            return;
        }

        // ✅ CASE 4: Brand new user never visited before — wipe and load fresh
        this.cache = { media: null, docs: null, audio: null, links: null };
        this.audioObjects = {};
        this.lastUserId = user.id;

        this.currentType = 'media';
        this.offset = 0;
        this.hasMore = true;
        this.loading = false;

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
            this.rebindAudio();
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
    audio.preload = 'metadata'; // ✅
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
rebindAudio: function()
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

// ADD THIS after _rebindAudio: function() { ... },

showPane: function(type, userId)
{
    const container = document.getElementById('shared-container');

    // ✅ Hide all panes
    container.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

    // ✅ Check if pane already exists (already loaded before)
    let pane = container.querySelector(`.tab-pane[data-type="${type}"]`);

    if(pane){
        // ✅ Just show it — no reload, no re-fetch, images stay intact
        pane.style.display = 'block';

        // Rebind audio events (audio elements lose onclick after hide/show)
        if(type === 'audio'){
            this.rebindAudio();
        }
        return;
    }

    // ✅ First time — create the pane and load into it
    pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.setAttribute('data-type', type);
    pane.style.display = 'block';
    container.appendChild(pane);

    // Temporarily point shared-container reads to this pane
    this.offset = 0;
    this.hasMore = true;
    this.loading = false;

    this.loadSharedIntoPane(pane, type, userId);

    container.onscroll = () => {
        if(ProfilePanel.loading || !ProfilePanel.hasMore) return;
        if(container.scrollTop + container.clientHeight >= container.scrollHeight - 50){
            ProfilePanel.loadSharedIntoPane(pane, type, userId);
        }
    };
},

// ADD THIS after _showPane: function() { ... },

loadSharedIntoPane: function(pane, type, userId)
{
    if(this.loading || !this.hasMore) return;

    this.loading = true;

    if(this.requestController){
        this.requestController.abort();
    }

    this.requestController = new AbortController();

    fetch(`/user/shared/${userId}?type=${type}&offset=${this.offset}`, {
        signal: this.requestController.signal
    })
    .then(res => res.json())
    .then(data => {
        if(!data || !data.items) return;

        if(type === 'media'){
            let grid = pane.querySelector('.media-grid');
            if(!grid){
                grid = document.createElement('div');
                grid.className = 'media-grid';
                pane.appendChild(grid);
            }

            const divMap = {};

            data.items.forEach(msg => {
                const div = document.createElement('div');
                div.className = 'media-thumb';

                const thumb = msg.media.thumbnail_path ? `/media/thumb/${msg.id}` : '';
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

            const receiverIds = Object.keys(divMap);
            if(receiverIds.length > 0){
                $.ajax({
                    url: '/download/status/batch',
                    method: 'POST',
                    contentType: 'application/json',
                    headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
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

        if(type === 'docs'){
            data.items.forEach(msg => {
                const div = document.createElement('div');
                const isMine = msg.sender_id == window.AUTH_USER_ID;

                if(isMine || msg.downloaded){
                    div.style.cursor = 'pointer';
                    div.innerHTML = `📄 ${msg.media.file_name}`;
                    div.onclick = function(){ window.open(`/media/${msg.id}`, '_blank'); };
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
                pane.appendChild(div);
            });
        }

        if(type === 'audio'){

            function formatTime(sec){
                const m = Math.floor(sec / 60);
                const s = Math.floor(sec % 60);
                return `${m}:${s < 10 ? '0'+s : s}`;
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
let audio = ProfilePanel.audioObjects[msg.id];
if(!audio){
    audio = new Audio(`/media/${msg.id}`);
    audio.preload = 'metadata'; // ✅
    ProfilePanel.audioObjects[msg.id] = audio;
}

                    const playBtn = div.querySelector('.audio-play');
                    const timeEl  = div.querySelector('.audio-time');
                    const bar     = div.querySelector('.audio-progress-bar');
                    const progressContainer = div.querySelector('.audio-progress');

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

                    audio.onloadedmetadata = () => { timeEl.innerText = formatTime(audio.duration); };

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
    div.className = 'audio-item';
    div.dataset.id = msg.id;
    div.style.opacity = '0.6';
    div.style.cursor = 'pointer';
    div.innerHTML = `
        <div class="audio-play" style="background:#2a3942;font-size:16px;">🔒</div>
        <div class="audio-info">
            <div class="audio-name">${msg.media.file_name}</div>
            <div class="audio-time">--:--</div>
            <div class="audio-progress">
                <div class="audio-progress-bar"></div>
            </div>
        </div>
    `;
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

pane.appendChild(div);
            });
        }

        if(type === 'links'){
            data.items.forEach(msg => {
                const div = document.createElement('div');
                div.innerHTML = msg.message;
                pane.appendChild(div);
            });
        }

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


// REPLACE WITH:
openSharedOverview: function()
{
    const userId = document.getElementById('blockBtn').dataset.userId;

    document.getElementById('shared-screen').classList.add('active');

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-type="media"]').classList.add('active');

    this.currentType = 'media';

    // ✅ Show media pane, hide others
    this.showPane('media', userId);
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

// REPLACE WITH:
document.addEventListener('click', function(e){

    if(e.target.classList.contains('tab')){

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        const type = e.target.dataset.type;
        if(ProfilePanel.currentType === type) return;

        const userId = document.getElementById('blockBtn').dataset.userId;
        ProfilePanel.currentType = type;

        ProfilePanel.showPane(type, userId);
    }
});