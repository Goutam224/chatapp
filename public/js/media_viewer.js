window.MediaViewer = {

    mediaList: [],
    currentIndex: 0,
    scale: 1,
    startX: 0,
    currentTranslate: 0,

    init() {

        document.addEventListener('click', (e) => {

            const el = e.target.closest('[data-media-view]');
            if(!el) return;

          const container =
    el.closest('#shared-container') ||
    el.closest('#chat-messages') ||
    document;

const all = [...container.querySelectorAll('[data-media-view]')];

this.mediaList = all.map(item => ({
    url: item.getAttribute('data-url'),
    type: item.getAttribute('data-type'),
    sender: item.getAttribute('data-sender'),
    fileSize: item.getAttribute('data-file-size'),
    thumb: item.getAttribute('data-thumb')
}));


            this.currentIndex = all.indexOf(el);

            this.openCurrent();
        });

        document.addEventListener('keydown', (e) => {
            if(e.key === "Escape") this.close();
            if(e.key === "ArrowRight") this.next();
            if(e.key === "ArrowLeft") this.prev();
        });
    },
openCurrent() {
this.scale = 1;
this.currentTranslate = 0;
    const modal = document.getElementById('media-viewer-modal');
    const content = document.getElementById('media-viewer-content');
    content.innerHTML = '';
    const item = this.mediaList[this.currentIndex];

    if(!item) return;

    const messageId = item.url.split('/').pop();
    const isMine = item.sender == window.AUTH_USER_ID;

    // ✅ SENDER SIDE → ALWAYS SHOW PREVIEW
    if (isMine) {

        if(item.type === 'image'){
            content.innerHTML =
                `<img src="${item.url}" 
     class="mv-media mv-image"
     decoding="async"
     loading="eager">`;
        }
        else if(item.type === 'video'){
            content.innerHTML =
                `<video controls autoplay class="mv-media mv-video">
                    <source src="${item.url}">
                 </video>`;
        }

        modal.classList.add('active');
        this.attachZoom();
        this.attachSwipe();
        return; // 🚨 IMPORTANT
    }

    // ✅ RECEIVER SIDE
    $.ajax({
        url: '/download/status/' + messageId,
        method: 'GET',
        success: (status) => {

            if(status.exists && status.completed == 1){

                if(item.type === 'image'){
                    content.innerHTML =
                        `<img src="${item.url}" 
     class="mv-media mv-image"
     decoding="async"
     loading="eager">`;
                }
                else if(item.type === 'video'){
                    content.innerHTML =
                        `<video controls autoplay class="mv-media mv-video">
                            <source src="${item.url}">
                         </video>`;
                }

            } else {

                content.innerHTML =
                    MediaDownloader.renderDownloadUI({
                        id: messageId,
                        sender_id: item.sender,
                        type: item.type,
                        media: {
                            file_size: item.fileSize ?? 0,
                            thumbnail_path: item.thumb
                        }
                    });
            }

            modal.classList.add('active');
            this.attachZoom();
            this.attachSwipe();
        }
    });
    this.preloadAdjacent();
},

    next(){
        if(this.currentIndex < this.mediaList.length - 1){
            this.currentIndex++;
            this.openCurrent();
        }
    },

    prev(){
        if(this.currentIndex > 0){
            this.currentIndex--;
            this.openCurrent();
        }
    },

    preloadAdjacent(){

    const next = this.mediaList[this.currentIndex + 1];
    const prev = this.mediaList[this.currentIndex - 1];

    [next, prev].forEach(item => {

        if(!item) return;

        if(item.type === 'image'){
            const img = new Image();
            img.src = item.url;
        }

        if(item.type === 'video'){
            const video = document.createElement('video');
            video.preload = "metadata";
            video.src = item.url;
        }

    });

},

  close(){

    const modal = document.getElementById('media-viewer-modal');

    const video = modal.querySelector('video');
    if(video){
        video.pause();
        video.currentTime = 0;
    }

    const audio = modal.querySelector('audio');
    if(audio){
        audio.pause();
        audio.currentTime = 0;
    }

    modal.classList.remove('active');

    this.scale = 1;
},

    attachZoom(){

        const media = document.querySelector('.mv-media');
        if(!media) return;

        // Desktop zoom
        media.onwheel = (e) => {
            e.preventDefault();
            this.scale += e.deltaY * -0.001;
            this.scale = Math.min(Math.max(1, this.scale), 4);
           media.style.transform = `scale(${this.scale}) translateZ(0)`;
        };

        // Mobile pinch zoom
        let initialDistance = 0;

        media.addEventListener('touchmove', (e) => {

            if(e.touches.length === 2){

                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;

                const distance = Math.sqrt(dx*dx + dy*dy);

                if(!initialDistance){
                    initialDistance = distance;
                } else {
                    this.scale = distance / initialDistance;
                    this.scale = Math.min(Math.max(1, this.scale), 4);
                media.style.transform = `scale(${this.scale}) translateZ(0)`;
                }
            }
        });

        media.addEventListener('touchend', () => {
            initialDistance = 0;
        });
    },

    attachSwipe(){

        const media = document.querySelector('.mv-media');
        if(!media) return;

        media.addEventListener('touchstart', (e)=>{
            this.startX = e.touches[0].clientX;
        });

        media.addEventListener('touchend', (e)=>{
            const endX = e.changedTouches[0].clientX;
            const diff = this.startX - endX;

            if(Math.abs(diff) > 50){
                if(diff > 0) this.next();
                else this.prev();
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', function(){
    MediaViewer.init();
});