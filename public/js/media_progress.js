/*
|--------------------------------------------------------------------------
| WhatsApp-style circular upload progress inside message bubble
|--------------------------------------------------------------------------
*/

window.MediaProgress = {

    activeUploads: {},

setUploadUuid(tempId, upload_uuid)
{

    const upload =
    this.activeUploads[tempId];

    if(!upload) return;

    upload.bubble.dataset.uploadUuid =
    upload_uuid;
upload.bubble.dataset.mimeType = upload.file.type;
},

   createBubble(file)
{

   const id =
'upload_' +
Date.now() +
'_' +
Math.floor(Math.random() * 1000000);



    const container =
    document.getElementById(
        'chat-messages'
    );

    if(!container) return;


    /*
    |--------------------------------------------------------------------------
    | MAIN MESSAGE BUBBLE
    |--------------------------------------------------------------------------
    */
    const bubble =
    document.createElement('div');

   bubble.className = 'msg msg-right';

bubble.dataset.tempId = id;
bubble.dataset.uploading = "1";
bubble.dataset.mimeType = file.type;
bubble.style.position = 'relative';

    /*
    |--------------------------------------------------------------------------
    | MEDIA PREVIEW
    |--------------------------------------------------------------------------
    */
    const url =
    URL.createObjectURL(file);


   let mediaHtml = '';

const fileName = file.name;
const fileExt = fileName.split('.').pop().toUpperCase();
const sizeMB = (file.size / (1024*1024)).toFixed(1);

if(file.type.startsWith('image'))
{
    mediaHtml = `
   <div class="wa-media-box" style="width:260px;height:180px;padding:0;overflow:hidden;border-radius:8px;margin:-4px;position:relative;">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;">
        <div class="upload-eta" style="position:absolute;bottom:6px;left:8px;font-size:11px;color:white;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:6px;white-space:nowrap;z-index:5;">${sizeMB} MB</div>
    </div>
    `;
}
else if(file.type.startsWith('video'))
{
    mediaHtml = `
  <div class="wa-media-box" style="width:260px;height:180px;padding:0;overflow:hidden;border-radius:8px;margin:-4px;position:relative;">
        <video src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;" muted></video>
        <div class="upload-eta" style="position:absolute;bottom:6px;left:8px;font-size:11px;color:white;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:6px;white-space:nowrap;z-index:5;">${sizeMB} MB</div>
    </div>
    `;
}
else if(file.type.startsWith('audio'))
{
    mediaHtml = `
        <div class="wa-media-box"
             style="
                width:260px;
                height:80px;
                display:flex;
                align-items:center;
                gap:12px;
                padding:12px;
                box-sizing:border-box;
                background:#111b21;
                border-radius:12px;
             ">

            <div style="
                width:44px;
                height:44px;
                background:#1d282f;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                color:#25D366;
                font-size:18px;
                flex-shrink:0;
            ">
                🎵
            </div>

            <div style="flex:1;">
                <div style="
                    height:4px;
                    background:#2a3942;
                    border-radius:4px;
                    margin-bottom:6px;
                "></div>

                <div style="
                    font-size:12px;
                    color:#8696a0;
                ">
                    ${sizeMB} MB
                </div>
            </div>

        </div>
    `;
}
else
{
    mediaHtml = `
        <div class="wa-media-box wa-doc" style="position:relative;">

            <div style="
                width:40px;
                height:48px;
                background:#1d282f;
                border-radius:6px;
                display:flex;
                align-items:center;
                justify-content:center;
                flex-shrink:0;
                font-size:11px;
                font-weight:bold;
                color:#25D366;
            ">
                ${fileExt}
            </div>

            <div style="flex:1;min-width:0;">
                <div style="
                    font-size:14px;
                    color:#e9edef;
                    font-weight:500;
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis;
                ">
                    ${fileName}
                </div>

                <div style="
                    font-size:12px;
                    color:#8696a0;
                    margin-top:3px;
                ">
                    ${fileExt} • ${sizeMB} MB
                </div>
            </div>

            <div class="doc-upload-circle" id="${id}_doc_overlay" style="flex-shrink:0;width:48px;height:48px;position:relative;cursor:pointer;">
                <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                    <circle cx="24" cy="24" r="20" stroke="white" stroke-width="3"
                        fill="none"
                        stroke-dasharray="126"
                        stroke-dashoffset="126"
                        stroke-linecap="round"
                        transform="rotate(-90 24 24)"
                        id="${id}_progress"/>
                    <rect x="19" y="19" width="10" height="10" fill="white" rx="2"/>
                </svg>
            </div>

        </div>
    `;
}


    /*
    |--------------------------------------------------------------------------
    | PROGRESS CIRCLE (WHATSAPP STYLE)
    |--------------------------------------------------------------------------
    */
    const overlay =
    document.createElement('div');
overlay.style.position = 'absolute';
overlay.style.top = '50%';
overlay.style.left = '50%';
overlay.style.transform = 'translate(-50%, -50%)';
overlay.style.zIndex = '10';


overlay.innerHTML =
`
<svg width="48" height="48"
     style="cursor:pointer;"
     id="${id}_cancel">

        <circle
            cx="24"
            cy="24"
            r="20"
            stroke="rgba(255,255,255,0.25)"
            stroke-width="3"
            fill="rgba(0,0,0,0.35)"
        />

        <circle
            cx="24"
            cy="24"
            r="20"
            stroke="white"
            stroke-width="3"
            fill="none"
            stroke-dasharray="126"
            stroke-dashoffset="126"
            stroke-linecap="round"
            transform="rotate(-90 24 24)"
            id="${id}_progress"
        />

        <rect
            x="19"
            y="19"
            width="10"
            height="10"
            fill="white"
            rx="2"
        />

</svg>
`;


    /*
    |--------------------------------------------------------------------------
    | TIME
    |--------------------------------------------------------------------------
    */
    const time =
    document.createElement('div');

    time.className =
    'time';

    time.innerHTML =
formatTime(new Date())
+
getClockIcon();


    bubble.innerHTML =
    mediaHtml;

  /*
|---------------------------------------
| Cancel button (WhatsApp style)
|---------------------------------------
*/
const cancelBtn = document.createElement('div');

cancelBtn.innerHTML = '✕';

cancelBtn.style.position = 'absolute';
cancelBtn.style.top = '6px';
cancelBtn.style.right = '6px';
cancelBtn.style.width = '22px';
cancelBtn.style.height = '22px';
cancelBtn.style.borderRadius = '50%';
cancelBtn.style.background = 'rgba(0,0,0,0.6)';
cancelBtn.style.color = 'white';
cancelBtn.style.display = 'flex';
cancelBtn.style.alignItems = 'center';
cancelBtn.style.justifyContent = 'center';
cancelBtn.style.cursor = 'pointer';
cancelBtn.style.fontSize = '14px';

const mediaBox = bubble.querySelector('.wa-media-box');
const isDoc = !file.type.startsWith('image') && !file.type.startsWith('video') && !file.type.startsWith('audio');

if(isDoc) {
    // For docs: use inline circle, no floating overlay, no cancel X button
    const docOverlay = bubble.querySelector(`#${id}_doc_overlay`);
    if(docOverlay) {
        docOverlay.onclick = (e) => {
            e.stopPropagation();
            const upload = this.activeUploads[id];
            if(!upload) return;
            if(upload.cancelled || upload.locked) return;
            upload.cancelled = true;
            upload.locked = true;
            const bubbleRef = upload.bubble;
            const fileRef = upload.file;
            const uuidRef = upload.bubble.dataset.uploadUuid ?? null;
            if(upload.xhr) upload.xhr.abort();
            setTimeout(() => {
                this.showCancelled(bubbleRef, fileRef, uuidRef);
            }, 100);
        };
    }
} else {
    // For image/video/audio: floating center overlay + cancel X
    bubble.appendChild(cancelBtn);
    if (mediaBox) {
        mediaBox.style.position = 'relative';
        mediaBox.appendChild(overlay);
    } else {
        bubble.appendChild(overlay);
    }
    overlay.style.zIndex = '10';
    overlay.onclick = (e) => {
        e.stopPropagation();
        const upload = this.activeUploads[id];
        if(!upload) return;
        if(upload.cancelled || upload.locked) return;
        upload.cancelled = true;
        upload.locked = true;
        const bubbleRef = upload.bubble;
        const fileRef = upload.file;
        const uuidRef = upload.bubble.dataset.uploadUuid ?? null;
        if(upload.xhr) upload.xhr.abort();
        setTimeout(() => {
            this.showCancelled(bubbleRef, fileRef, uuidRef);
        }, 100);
    };
};
bubble.appendChild(time);

    container.appendChild(bubble);

    container.scrollTop =
    container.scrollHeight;


this.activeUploads[id] =
{
    bubble: bubble,

    progressCircle:
        bubble.querySelector('#'+id+'_progress'),

    cancelBtn: cancelBtn,

    file: file,

    cancelled: false,

    locked: false, // ✅ CRITICAL FIX

    xhr: null
};

/*
|---------------------------------------
| Click circle to cancel upload
|---------------------------------------
*/
this.activeUploads[id].cancelBtn.onclick = () =>
{
    const upload = this.activeUploads[id];

    if(!upload) return;

    if(upload.cancelled || upload.locked) return;

    upload.cancelled = true;
    upload.locked = true;

    const bubbleRef = upload.bubble;
    const fileRef = upload.file;
    const uuidRef = upload.bubble.dataset.uploadUuid ?? null;

    if(upload.xhr)
    {
        upload.xhr.abort();
    }

    setTimeout(() => {
        this.showCancelled(bubbleRef, fileRef, uuidRef);
    }, 100);
};

    return id;

},
showCancelled(bubble, file, upload_uuid=null)
{
    const sizeMB =
    (file.size / (1024*1024)).toFixed(1);
// ✅ CRITICAL FIX — completely remove old upload state
bubble.removeAttribute("data-finished");
  
let isAudio = false;

if(file && file.type)
{
    isAudio = file.type.startsWith('audio');
}
else if(bubble.dataset.mimeType)
{
    isAudio = bubble.dataset.mimeType.startsWith('audio');
}

if(isAudio)
{
    bubble.innerHTML = `
    <div class="wa-media-box"
         style="
            width:260px;
            height:80px;
            display:flex;
            align-items:center;
            gap:12px;
            padding:12px;
            box-sizing:border-box;
            background:#111b21;
            border-radius:12px;
            cursor:pointer;
         ">

        <div style="
            width:44px;
            height:44px;
            background:#1d282f;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#25D366;
            font-size:18px;
            flex-shrink:0;">
            🎵
        </div>

        <div style="flex:1;">
            <div style="
                height:4px;
                background:#2a3942;
                border-radius:4px;
                margin-bottom:6px;
                position:relative;">
                
                <div style="
                    position:absolute;
                    right:0;
                    top:-6px;
                    font-size:10px;
                    color:#53bdeb;">
                    Resume
                </div>
            </div>

            <div style="
                font-size:12px;
                color:#8696a0;">
                ${sizeMB} MB • Click to resume
            </div>
        </div>

    </div>
    `;
}
else
{
    const existingMediaBox = bubble.querySelector('.wa-media-box');

    // Doc pause UI — replace circle with resume arrow inline
    const isDocBubble = existingMediaBox && existingMediaBox.classList.contains('wa-doc');
    if(isDocBubble) {
        const docCircle = existingMediaBox.querySelector('.doc-upload-circle');
        if(docCircle) {
            docCircle.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 48 48" style="cursor:pointer;">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                    <polyline points="24,15 24,33" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    <polyline points="16,22 24,14 32,22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
            `;
            docCircle.onclick = (e) => {
                e.stopPropagation();
                docCircle.onclick = null;
                const uuid = upload_uuid || bubble.dataset.uploadUuid;
                if(!uuid) return;
                delete window.pausedUploadUUIDs[uuid];
                delete window.uploadLocks[uuid];
                delete window.finishLocks[uuid];
                MediaUpload.resumeUpload(uuid, file, bubble, bubble.dataset.tempId);
            };
        }
        bubble.dataset.uploading = "1";
        bubble.dataset.finished = null;
        bubble.onclick = null;
        return;
    }

    const mediaImg = existingMediaBox ? existingMediaBox.querySelector('img, video') : null;
    const mediaSrc = mediaImg ? (mediaImg.src || '') : '';
    const isVideo = mediaImg && mediaImg.tagName === 'VIDEO';

    // Wipe everything first
    bubble.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'wa-media-box resume-upload';
    wrapper.style.cssText = 'width:260px;height:180px;padding:0;overflow:hidden;border-radius:8px;margin:-4px;position:relative;cursor:pointer;';

    if(isVideo && mediaSrc) {
        const vid = document.createElement('video');
        vid.src = mediaSrc;
        vid.muted = true;
        vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        wrapper.appendChild(vid);
    } else if(mediaSrc) {
        const img = document.createElement('img');
        img.src = mediaSrc;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        wrapper.appendChild(img);
    } else {
        const bg = document.createElement('div');
        bg.style.cssText = 'width:100%;height:100%;background:#1d282f;';
        wrapper.appendChild(bg);
    }

   const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';
    overlay.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" style="cursor:pointer;">
            <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.25)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
            <polyline points="24,15 24,33" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <polyline points="16,22 24,14 32,22" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <div style="font-size:11px;color:white;font-weight:500;background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:8px;">${sizeMB} MB</div>
    `;

    wrapper.appendChild(overlay);
    bubble.appendChild(wrapper);
}
bubble.dataset.uploading = "1"; 
// ✅ allow resume to work
bubble.dataset.finished = null;
    // CRITICAL FIX — prevent auto resume
    bubble.onclick = null;
const resumeBox =
bubble.querySelector('.wa-media-box') ||
bubble.querySelector('.resume-upload');

if(!resumeBox) return;

resumeBox.onclick = (e) =>
{
    e.stopPropagation();

    resumeBox.onclick = null;

    if(!upload_uuid)
        upload_uuid = bubble.dataset.uploadUuid;

    if(!upload_uuid) return;

    delete window.pausedUploadUUIDs[upload_uuid];
    delete window.uploadLocks[upload_uuid];
    delete window.finishLocks[upload_uuid];

    MediaUpload.resumeUpload(
        upload_uuid,
        file,
        bubble,
        bubble.dataset.tempId
    );
};
},

update(id, percent)
{
    const upload = this.activeUploads[id];

    if(!upload) return;

    const circle = upload.progressCircle;

    if(!circle) return;

    const radius = 20;
    const circumference = 2 * Math.PI * radius; // 126

    const offset = circumference - (percent / 100) * circumference;

    // REQUIRED for proper animation
    circle.style.strokeDasharray = circumference;

    // this moves the progress visually
    circle.style.strokeDashoffset = offset;

    // optional smooth animation like WhatsApp
    circle.style.transition = "stroke-dashoffset 0.15s linear";
},


finish(id, message)
{
    const upload = this.activeUploads[id];

    if(!upload) return;

    const bubble = upload.bubble;

    bubble.setAttribute('data-finished', '1');

    bubble.removeAttribute('data-temp-id');
    bubble.removeAttribute('data-uploading');
    
    // Remove any ghost bubbles with same file that are still uploading
// Only remove THIS bubble's uploading state, never touch others

    bubble.dataset.id = message.id;

  bubble.setAttribute('data-id', message.id);
bubble.setAttribute('data-upload-uuid', message.upload_uuid ?? id); // optional but safe

    let tick = '✔';

    if(message.seen_at)
        tick = '<span style="color:#53bdeb">✔✔</span>';
    else if(message.delivered_at)
        tick = '✔✔';

   bubble.innerHTML =
    `<div class="msg-hover-arrow"></div>` +
    `<div class="msg-content">${renderMessageContent(message)}</div>` +
    `<div class="time">
        ${formatTime(
            message.sent_at ?? message.created_at
        )} ${tick}
    </div>`;

    delete this.activeUploads[id];
},


    formatTime()
    {

        return new Date()
        .toLocaleTimeString([], {
            hour:'numeric',
            minute:'2-digit'
        });

    }

};
