window.MessageInfo = {

open:function(messageId){

fetch('/message/info/' + messageId)
.then(res=>res.json())
.then(data=>{

    document.getElementById('mi-read-time').innerText =
        data.seen_at ?? '-';

    document.getElementById('mi-delivered-time').innerText =
        data.delivered_at ?? '-';
const preview = document.getElementById('mi-preview-content');
preview.innerHTML = '';

if(data.type === 'image'){

preview.innerHTML = `
<div class="mi-media mi-image">
<img src="/storage/${data.media.file_path}" loading="lazy">
</div>
`;

}

else if(data.type === 'video'){

preview.innerHTML = `
<div class="mi-media mi-video">
<video controls playsinline preload="metadata">
<source src="/storage/${data.media.file_path}" type="video/mp4">
</video>
</div>
`;

}

else if(data.type === 'audio'){

preview.innerHTML = `
<div class="mi-media mi-audio">
    <button class="mi-audio-play" onclick="
        var a=this.closest('.mi-audio').querySelector('audio');
        if(a.paused){a.play();this.innerHTML='⏸';}else{a.pause();this.innerHTML='▶';}
    ">▶</button>
    <div class="mi-audio-body">
        <div class="mi-audio-progress">
            <div class="mi-audio-filled" id="mi-audio-filled"></div>
            <div class="mi-audio-dot" id="mi-audio-dot"></div>
        </div>
        <div class="mi-audio-duration" id="mi-audio-dur">0:00</div>
    </div>
    <div class="mi-audio-avatar">🎧</div>
    <audio preload="metadata" style="display:none">
        <source src="/storage/${data.media.file_path}">
    </audio>
</div>
`;

const aud = preview.querySelector('audio');
aud.addEventListener('loadedmetadata', () => {
    const mins = Math.floor(aud.duration / 60);
    const secs = String(Math.floor(aud.duration % 60)).padStart(2,'0');
    preview.querySelector('#mi-audio-dur').innerText = mins + ':' + secs;
});
aud.addEventListener('timeupdate', () => {
    const pct = aud.duration ? (aud.currentTime / aud.duration) * 100 : 0;
    preview.querySelector('#mi-audio-filled').style.width = pct + '%';
    preview.querySelector('#mi-audio-dot').style.left = pct + '%';
});

}

else if(data.type === 'file'){

const sizeKb = data.file_size ? Math.round(data.file_size / 1024) + ' KB' : '';
const ext = data.file_ext || 'FILE';

preview.innerHTML = `
<div class="mi-media mi-doc">
    <div class="mi-doc-icon">📄</div>
    <div class="mi-doc-info">
        <a href="/storage/${data.media.file_path}" target="_blank" class="mi-doc-name">
            ${data.file_name}
        </a>
        <span class="mi-doc-meta">${ext}${sizeKb ? ' • ' + sizeKb : ''}</span>
    </div>
    <a href="/storage/${data.media.file_path}" download class="mi-doc-download">⬇</a>
</div>
`;

}

else{

preview.innerText = data.message ?? '';

}
document.getElementById('mi-preview-date').innerText =
    data.date_label ?? '';
    document.getElementById('mi-preview-time').innerText =
        data.time ?? '';

    document
        .getElementById('message-info-panel')
        .classList.add('open');

});

},

close:function(){

document
.getElementById('message-info-panel')
.classList.remove('open');

}

};