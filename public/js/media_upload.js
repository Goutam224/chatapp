window.currentMediaCaption = null;

window.pausedUploadUUIDs = window.pausedUploadUUIDs || {};
// window.pausedUploads was historically used but is no longer needed
// window.pausedUploads = window.pausedUploads || {};
window.finishLocks = window.finishLocks || {};
// prevents duplicate upload loops per UUID
window.uploadLocks = window.uploadLocks || {};


// ✅ INIT IndexedDB (run once)
const uploadDBRequest = indexedDB.open('UploadDB', 1);

uploadDBRequest.onupgradeneeded = function(e) {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files');
    }
};

window.MediaUpload = (function() {

    const CHUNK_SIZE = 1024 * 1024; // 1MB

    function safe(docSelector) {
        return document.querySelector(docSelector);
    }

    function jsonFetch(url, opts = {}) {
        return fetch(url, opts).then(r => r.json());
    }

    function createUploadObj(bubbleId, bubble, file) {
        MediaProgress.activeUploads[bubbleId] = {
            bubble,
            progressCircle: bubble.querySelector(`#${bubbleId}_progress`) || null,
            cancelBtn: bubble.querySelector(`#${bubbleId}_cancel`) 
        || bubble.querySelector('.upload-cancel') 
        || null,
            file,
            cancelled: false,
            locked: false,
            xhr: null
        };
        return MediaProgress.activeUploads[bubbleId];
    }

    function setLock(uuid) {
        window.uploadLocks[uuid] = true;
    }

    function clearLock(uuid) {
        delete window.uploadLocks[uuid];
    }

    function setPaused(uuid) {
        window.pausedUploadUUIDs[uuid] = true;
    }

    function clearPaused(uuid) {
        delete window.pausedUploadUUIDs[uuid];
    }

    return {

        /*
        |------------------------------------------------------------------
        | Send multiple files
        |------------------------------------------------------------------
        */
        send(files) {
            if (!files || !files.length) return;
            Array.from(files).forEach(file => this.uploadSingle(file));
        },

        /*
        |------------------------------------------------------------------
        | Upload single file (start session then upload chunks)
        |------------------------------------------------------------------
        */
        uploadSingle(file) {
            // ✅ Store file in IndexedDB using upload_uuid later
const storeFileInDB = (uuid, file) => {
    const request = indexedDB.open('UploadDB', 1);
    request.onsuccess = function(e) {
        const db = e.target.result;
        const tx = db.transaction(['files'], 'readwrite');
        const store = tx.objectStore('files');
        store.put(file, uuid);

        const thumbKey = uuid + '_thumb';
        if(file.type.startsWith('image')) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                const tx2 = db.transaction(['files'], 'readwrite');
                tx2.objectStore('files').put(ev.target.result, thumbKey);
            };
            reader.readAsDataURL(file);
        } else if(file.type.startsWith('video')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.currentTime = 1;
            video.onloadeddata = function() {
                const canvas = document.createElement('canvas');
                canvas.width = 260;
                canvas.height = 180;
                canvas.getContext('2d').drawImage(video, 0, 0, 260, 180);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                const tx2 = db.transaction(['files'], 'readwrite');
                tx2.objectStore('files').put(dataUrl, thumbKey);
                URL.revokeObjectURL(video.src);
            };
        }
    };
};
            if (!window.currentChatId) return;

            const bubbleId = MediaProgress.createBubble(file);
UploadETA.start(bubbleId, file.size);
            // STEP 1: START upload session
            jsonFetch('/upload/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': safe('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    chat_id: window.currentChatId,
                    file_name: file.name,
                    mime_type: file.type,
                    file_size: file.size
                })
            }).then(session => {
                const upload_uuid = session.upload_uuid;
                // ✅ Save file in IndexedDB using uuid
storeFileInDB(upload_uuid, file);
             // link bubble to upload_uuid
                MediaProgress.setUploadUuid(bubbleId, upload_uuid);

                // ✅ Save caption to IndexedDB so it survives refresh
                const captionVal = MediaProgress.activeUploads[bubbleId]?.bubble?.dataset?.caption || '';
                if(captionVal) {
                    const capReq = indexedDB.open('UploadDB', 1);
                    capReq.onsuccess = function(ev) {
                        const db = ev.target.result;
                        const tx = db.transaction(['files'], 'readwrite');
                        tx.objectStore('files').put(captionVal, upload_uuid + '_caption');
                    };
                }

                // start uploading chunks
                this.uploadChunks(file, upload_uuid, bubbleId, session.uploaded_bytes || 0);
            }).catch(e => {
                console.error('uploadSingle start failed', e);
            });
        },

        /*
        |------------------------------------------------------------------
        | Upload chunks loop
        |------------------------------------------------------------------
        */
        uploadChunks(file, upload_uuid, bubbleId, startByte = 0) {
            if (!upload_uuid) return;

            // make sure we never start more than one loop per uuid
            // previous implementation only blocked when startByte===0, which
            // allowed overlapping loops during resume; the race caused the
            // "unable to pause a second time" behaviour.  always guard here.
            if (window.uploadLocks[upload_uuid]) {
                console.log('uploadChunks blocked duplicate start', upload_uuid);
                return;
            }
            setLock(upload_uuid);

            let offset = parseInt(startByte || 0);
            let stopped = false;

            const getUploadObj = () => MediaProgress.activeUploads[bubbleId];
            const chunkSize = CHUNK_SIZE;

            const uploadNext = () => {
                // paused externally
                if (window.pausedUploadUUIDs[upload_uuid]) {
                    console.log('BLOCKED: upload paused UUID =', upload_uuid);
                    return;
                }

                const upload = getUploadObj();
                console.debug('UPLOAD CHUNKS DEBUG', { bubbleId, uploadExists: !!upload, cancelled: upload?.cancelled, locked: upload?.locked });

                if (stopped || !upload || upload.cancelled || upload.locked) {
                    console.log('Upload stopped:', bubbleId);
                    return;
                }

                // finished locally: verify server
                if (offset >= file.size) {
                    console.log('OFFSET reached end, verifying server:', upload_uuid);
                    return fetch('/upload/status/' + upload_uuid)
                        .then(res => res.json())
                        .then(status => {
                            const serverUploaded = parseInt(status.uploaded_bytes || 0);
                            const serverSize = parseInt(status.file_size || 0);
                            console.log('SERVER CHECK:', serverUploaded, '/', serverSize);
                            if (serverUploaded >= serverSize) {
                                console.log('SERVER CONFIRMED COMPLETE:', upload_uuid);
                                this.finishUpload(upload_uuid, bubbleId);
                            } else {
                                console.log('SERVER NOT COMPLETE, resuming upload:', upload_uuid);
                                offset = serverUploaded;
                                setTimeout(uploadNext, 100);
                            }
                        }).catch(err => {
                            console.error('status check failed', err);
                            setTimeout(uploadNext, 1000);
                        });
                }

                const chunk = file.slice(offset, offset + chunkSize);
                const formData = new FormData();
                formData.append('upload_uuid', upload_uuid);
                formData.append('chunk', chunk);

                const xhr = new XMLHttpRequest();
                upload.xhr = xhr;

                xhr.open('POST', '/upload/chunk', true);
                // WhatsApp-style real-time progress (byte level)
xhr.upload.onprogress = (e) => {

    if (!e.lengthComputable) return;

    const currentChunkProgress = e.loaded;

    const totalUploaded = offset + currentChunkProgress;

    const percent = Math.min(
        100,
        Math.round((totalUploaded / file.size) * 100)
    );

    MediaProgress.update(bubbleId, percent);

    // ✅ ADD THIS BLOCK
    const result = UploadETA.update(bubbleId, totalUploaded);

    if(result)
    {
        const upload = MediaProgress.activeUploads[bubbleId];

        if(upload && upload.bubble)
        {
            let etaDiv = upload.bubble.querySelector('.upload-eta');

if(!etaDiv)
{
    etaDiv = document.createElement('div');
    etaDiv.className = 'upload-eta';

    const isAudioBubble = upload.file && upload.file.type && upload.file.type.startsWith('audio');

    if(isAudioBubble) {
        // For audio: ETA goes inside the flex row (replace the size text)
        etaDiv.style.cssText = 'font-size:11px;color:#8696a0;margin-bottom:4px;white-space:nowrap;';
        const etaContainer = upload.bubble.querySelector('.wa-media-box > div:nth-child(2)');
        if(etaContainer) {
            etaContainer.insertBefore(etaDiv, etaContainer.firstChild);
        } else {
            upload.bubble.appendChild(etaDiv);
        }
    } else {
        etaDiv.style.cssText = 'position:absolute;bottom:6px;left:8px;font-size:11px;color:white;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:6px;white-space:nowrap;z-index:5;';
        const mediaBox = upload.bubble.querySelector('.wa-media-box');
        if(mediaBox) {
            mediaBox.appendChild(etaDiv);
        } else {
            upload.bubble.appendChild(etaDiv);
        }
    }
}


            etaDiv.innerText =
                result.speed + " • " + result.eta + " left";
        }
    }
};
                xhr.setRequestHeader('X-CSRF-TOKEN', safe('meta[name="csrf-token"]').content);

                xhr.onload = () => {
                    const up = getUploadObj();

                    if (stopped || !up || up.cancelled || up.locked) return;

                    if (xhr.status !== 200) {
                        console.log('Chunk failed, retrying...');
                        setTimeout(uploadNext, 2000);
                        return;
                    }

                    let res;
                    try { res = JSON.parse(xhr.responseText); }
                    catch (e) { setTimeout(uploadNext, 2000); return; }

                    if (res.error) {
                        setTimeout(uploadNext, 2000);
                        return;
                    }

                    offset += chunk.size;
                    const percent = Math.round((offset / file.size) * 100);
                    MediaProgress.update(bubbleId, percent);

                    // HARD STOP — UUID paused
                    if (window.pausedUploadUUIDs[upload_uuid]) {
                        console.log('STOPPED: paused UUID =', upload_uuid);
                        return;
                    }

                    const uploadObj = getUploadObj();
                    if (!uploadObj) { console.log('STOPPED: upload missing'); return; }
                    if (uploadObj.cancelled) { console.log('STOPPED: cancelled'); return; }
                    if (uploadObj.locked) { console.log('STOPPED: locked'); return; }
                    if (stopped) { console.log('STOPPED: stopped flag'); return; }

                    // schedule next chunk
                    setTimeout(uploadNext, 0);
                };

                xhr.onabort = () => {
                    console.log('XHR ABORT DEBUG for', upload_uuid);
                    stopped = true;
                    setPaused(upload_uuid);

                    clearLock(upload_uuid);

                    const uploadObj = getUploadObj();
                    if (uploadObj) {
                        uploadObj.cancelled = true;
                        uploadObj.locked = true;
                        uploadObj.xhr = null;
                    }

                    // INFORM SERVER
                    fetch('/upload/cancel/' + upload_uuid, {
                        method: 'POST',
                        headers: {
                            'X-CSRF-TOKEN': safe('meta[name="csrf-token"]').content
                        }
                    }).catch(() => { /* ignore */ });
                };

                xhr.onerror = () => {
                    console.log('XHR error, retrying...');
                    setTimeout(uploadNext, 2000);
                };

                xhr.send(formData);
            }; // uploadNext

            // start loop
            setTimeout(uploadNext, 0);
        }, // uploadChunks

        /*
        |------------------------------------------------------------------
        | Resume upload
        |------------------------------------------------------------------
        */
        resumeUpload(upload_uuid, file, bubble, oldTempId = null) {
            // as soon as we start a resume request clear any lingering pause/lock
            // flags for this uuid.  previously the flags were only cleared after
            // the file was loaded from IndexedDB or after the status check; if
            // the user tried to pause again during that window the logic could
            // get confused and further pauses would be ignored.
            if (upload_uuid) {
                clearPaused(upload_uuid);
                clearLock(upload_uuid);
                delete window.finishLocks[upload_uuid];
            }

            // ✅ If file is missing (after refresh), load from IndexedDB
            if (!file) {
                const request = indexedDB.open('UploadDB', 1);

            request.onsuccess = function(e) {
    const db = e.target.result;
    const tx = db.transaction(['files'], 'readonly');
    const store = tx.objectStore('files');

    const getReq = store.get(upload_uuid);

    getReq.onsuccess = function() {
        const storedFile = getReq.result;
        if (!storedFile) return;

        // ✅ Restore caption on bubble before resuming
        const capReq = db.transaction(['files'], 'readonly')
            .objectStore('files')
            .get(upload_uuid + '_caption');

        capReq.onsuccess = function() {
            if (capReq.result) {
                bubble.dataset.caption = capReq.result;
            }
            MediaUpload.resumeUpload(
                upload_uuid,
                storedFile,
                bubble,
                oldTempId
            );
        };

        capReq.onerror = function() {
            MediaUpload.resumeUpload(
                upload_uuid,
                storedFile,
                bubble,
                oldTempId
            );
        };
    };
};

                return;
            }
            // remove old upload object if present (cleanup)
            try {
                if (oldTempId && MediaProgress.activeUploads[oldTempId]) {
                    delete MediaProgress.activeUploads[oldTempId];
                }
            } catch (e) { /* ignore */ }

            if (!upload_uuid) return;

            console.log('RESUME UPLOAD START:', { upload_uuid, bubbleTempId: bubble?.dataset?.tempId, pausedUUIDs: window.pausedUploadUUIDs, uploadLocks: window.uploadLocks });
// ✅ ALWAYS clear pause state before resume
delete window.pausedUploadUUIDs[upload_uuid];
delete window.uploadLocks[upload_uuid];
delete window.finishLocks[upload_uuid];
            jsonFetch('/upload/status/' + upload_uuid).then(status => {
                if (status.status === 'completed') {
                    console.log('Already completed');
                    return;
                }

                const offset = parseInt(status.uploaded_bytes || 0);
                console.log('RESUME OFFSET:', offset);

                const newBubbleId = 'upload_resume_' + Date.now();
                UploadETA.start(newBubbleId, file.size);
                const previousTempId = bubble.dataset.tempId || null;

                // wipe old object if exists
                if (previousTempId && MediaProgress.activeUploads[previousTempId]) {
                    delete MediaProgress.activeUploads[previousTempId];
                }

                bubble.dataset.uploadUuid = upload_uuid;
                bubble.dataset.tempId = newBubbleId;

const url = URL.createObjectURL(file);

let mediaHtml = '';

const fileName = file.name;
const fileExt = fileName.split('.').pop().toUpperCase();
const sizeMB = (file.size / (1024*1024)).toFixed(1);
const _cap = bubble.dataset.caption || '';

if(file.type.startsWith('image'))
{
    mediaHtml = `
    <div style="width:260px;display:block;line-height:0;">
        <div class="wa-media-box" style="width:260px;height:180px;padding:0;overflow:hidden;border-radius:${_cap ? '10px 10px 0 0' : '10px'};position:relative;display:block;">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;">
        </div>
        ${_cap ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(_cap)}</div>` : ''}
    </div>`;
}
else if(file.type.startsWith('video'))
{
    mediaHtml = `
    <div style="width:260px;display:block;line-height:0;">
        <div class="wa-media-box" style="width:260px;height:180px;padding:0;overflow:hidden;border-radius:${_cap ? '10px 10px 0 0' : '10px'};position:relative;display:block;">
            <video src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;" muted></video>
        </div>
        ${_cap ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(_cap)}</div>` : ''}
    </div>`;
}
else if(file.type.startsWith('audio'))
{
    // --------------------------------------------------------
    // AUDIO resume: inline right-side circle — consistent with
    // createBubble (stop icon + progress arc on the right)
    // --------------------------------------------------------
    mediaHtml = `
    <div style="width:260px;display:block;">
        <div class="wa-media-box" style="width:260px;height:68px;display:flex;align-items:center;gap:12px;padding:12px;box-sizing:border-box;background:#111b21;border-radius:${_cap ? '10px 10px 0 0' : '10px'};">
            <div style="width:44px;height:44px;background:#1d282f;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#25D366;font-size:18px;flex-shrink:0;">
                🎵
            </div>
            <div style="flex:1;">
                <div class="upload-eta" style="font-size:11px;color:#8696a0;margin-bottom:4px;white-space:nowrap;">${sizeMB} MB</div>
                <div style="height:4px;background:#2a3942;border-radius:4px;"></div>
            </div>
            <div class="audio-upload-circle" id="${newBubbleId}_audio_overlay" style="flex-shrink:0;width:48px;height:48px;position:relative;cursor:pointer;">
                <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                    <circle cx="24" cy="24" r="20" stroke="white" stroke-width="3"
                        fill="none" stroke-dasharray="126" stroke-dashoffset="126"
                        stroke-linecap="round" transform="rotate(-90 24 24)"
                        id="${newBubbleId}_progress"/>
                    <rect x="19" y="19" width="10" height="10" fill="white" rx="2"/>
                </svg>
            </div>
        </div>
        ${_cap ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(_cap)}</div>` : ''}
    </div>`;
}
else
{
    mediaHtml = `
    <div style="width:260px;display:block;">
        <div class="wa-media-box wa-doc" style="border-radius:${_cap ? '10px 10px 0 0' : '10px'};">
            <div style="width:40px;height:48px;background:#1d282f;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:bold;color:#25D366;">
                ${fileExt}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:14px;color:#e9edef;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${fileName}
                </div>
                <div style="font-size:12px;color:#8696a0;margin-top:3px;">
                    ${fileExt} • ${sizeMB} MB
                </div>
            </div>
            <div class="doc-upload-circle" id="${newBubbleId}_doc_overlay" style="flex-shrink:0;width:48px;height:48px;position:relative;cursor:pointer;">
                <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                    <circle cx="24" cy="24" r="20" stroke="white" stroke-width="3"
                        fill="none" stroke-dasharray="126" stroke-dashoffset="126"
                        stroke-linecap="round" transform="rotate(-90 24 24)"
                        id="${newBubbleId}_progress"/>
                    <rect x="19" y="19" width="10" height="10" fill="white" rx="2"/>
                </svg>
            </div>
        </div>
        ${_cap ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(_cap)}</div>` : ''}
    </div>`;
}

bubble.innerHTML = mediaHtml;

// ✅ Re-add time with clock icon after resume bubble rebuild
const existingTime = bubble.querySelector('.time');
if(!existingTime) {
    const timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    timeDiv.innerHTML = formatTime(new Date()) + getClockIcon();
    bubble.appendChild(timeDiv);
}

// --------------------------------------------------------
// Wire overlay / cancel for the resumed bubble
// --------------------------------------------------------
const isAudioResume = file.type.startsWith('audio');
const isDocResume = !file.type.startsWith('image') && !file.type.startsWith('video') && !file.type.startsWith('audio');

// capture the tempId inside the closure instead of reading dataset each time
const thisTempId = newBubbleId;

bubble.style.position = 'relative';

if(isAudioResume) {
    // Audio: inline right-side circle click = cancel
    const audioOverlay = bubble.querySelector(`#${newBubbleId}_audio_overlay`);
    if(audioOverlay) {
        audioOverlay.onclick = (e) => {
            e.stopPropagation();
            const upload = MediaProgress.activeUploads[thisTempId];
            if(!upload) return;
            if(upload.cancelled || upload.locked) return;
            upload.cancelled = true;
            upload.locked = true;
            const bubbleRef = bubble;
            const fileRef = upload.file;
            const uuidRef = bubble.dataset.uploadUuid ?? null;
            if(upload.xhr) upload.xhr.abort();
            setTimeout(() => {
                MediaProgress.showCancelled(bubbleRef, fileRef, uuidRef);
            }, 100);
        };
    }
} else if(isDocResume) {
    const docOverlay = bubble.querySelector(`#${newBubbleId}_doc_overlay`);
    if(docOverlay) {
        docOverlay.onclick = (e) => {
            e.stopPropagation();
            const upload = MediaProgress.activeUploads[thisTempId];
            if(!upload) return;
            if(upload.cancelled || upload.locked) return;
            upload.cancelled = true;
            upload.locked = true;
            const bubbleRef = bubble;
            const fileRef = upload.file;
            const uuidRef = bubble.dataset.uploadUuid ?? null;
            if(upload.xhr) upload.xhr.abort();
            setTimeout(() => {
                MediaProgress.showCancelled(bubbleRef, fileRef, uuidRef);
            }, 100);
        };
    }
} else {
    // Image / video: floating center overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.zIndex = '10';
    overlay.style.cursor = 'pointer';

    overlay.onclick = (e) =>
    {
        e.stopPropagation();

        const upload = MediaProgress.activeUploads[thisTempId];
        if(!upload){
            console.log('Upload already finished');
            return;
        }
        if(upload.cancelled || upload.locked) return;

        upload.cancelled = true;
        upload.locked = true;

        const bubbleRef = bubble;
        const fileRef = upload.file;
        const uuidRef = upload.bubble.dataset.uploadUuid ?? null;

        if(upload.xhr)
        {
            upload.xhr.abort();
        }

        setTimeout(() => {
            MediaProgress.showCancelled(bubbleRef, fileRef, uuidRef);
        }, 100);
    };
    overlay.innerHTML = `
<svg width="48" height="48" style="cursor:pointer;" id="${newBubbleId}_cancel" class="upload-cancel">
    <circle cx="24" cy="24" r="20" stroke="#3b4a54" stroke-width="3" fill="none" />
    <circle cx="24" cy="24" r="20" stroke="white" stroke-width="3"
        fill="none"
        stroke-dasharray="126"
        stroke-dashoffset="126"
        stroke-linecap="round"
        transform="rotate(-90 24 24)"
        id="${newBubbleId}_progress"/>
    <rect x="18" y="18" width="12" height="12" fill="white" rx="2"/>
</svg>
`;
    const mediaBox = bubble.querySelector('.wa-media-box');
    if (mediaBox) {
        mediaBox.style.position = 'relative';
        mediaBox.appendChild(overlay);
    } else {
        bubble.appendChild(overlay);
    }
}

                // ensure fresh state
                bubble.cancelled = false; 
                bubble.locked = false;

                const uploadObj = createUploadObj(newBubbleId, bubble, file);
uploadObj.cancelled = false;
uploadObj.locked = false;
            

                // restore progress UI percent
                const percent = Math.round((offset / file.size) * 100);
                MediaProgress.update(newBubbleId, percent);
UploadETA.update(newBubbleId, offset);
                // clear any paused/lock flags and resume
                clearPaused(upload_uuid);
                clearLock(upload_uuid);

                this.uploadChunks(file, upload_uuid, newBubbleId, offset);
            }).catch(err => {
                console.error('resumeUpload failed', err);
            });
        },

        /*
        |------------------------------------------------------------------
        | Finish upload
        |------------------------------------------------------------------
        */
     finishUpload(upload_uuid, bubbleId) {
    if (window.finishLocks[upload_uuid]) {
        console.log('FINISH BLOCKED duplicate:', upload_uuid);
        return;
    }
    window.finishLocks[upload_uuid] = true;

    // ✅ If bubbleId not in activeUploads, find bubble by upload_uuid
    if (!MediaProgress.activeUploads[bubbleId]) {
        const fallbackBubble = document.querySelector(`[data-upload-uuid="${upload_uuid}"]`);
        if (fallbackBubble) {
            const fallbackId = 'fallback_' + Date.now();
            fallbackBubble.dataset.tempId = fallbackId;
            MediaProgress.activeUploads[fallbackId] = {
                bubble: fallbackBubble,
                progressCircle: null,
                cancelBtn: null,
                file: null,
                cancelled: false,
                locked: false,
                xhr: null
            };
            bubbleId = fallbackId;
        }
    }

    jsonFetch('/upload/finish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': safe('meta[name="csrf-token"]').content
                },
body: JSON.stringify({
    upload_uuid: upload_uuid,
    chat_id: window.currentChatId,
    caption: MediaProgress.activeUploads[bubbleId]?.bubble?.dataset?.caption || window.currentMediaCaption || null
})            }).then(data => {
                // remove locks even if not successful so user can try again/cancel
                delete window.finishLocks[upload_uuid];
                clearLock(upload_uuid);
                clearPaused(upload_uuid);

                if (!data || !data.success) return;

                // update bubble uploadUuid if server returned new uuid
                if (data.upload_uuid) {
                    const bubble = MediaProgress.activeUploads[bubbleId]?.bubble;
                    if (bubble) bubble.dataset.uploadUuid = data.upload_uuid;
                }

                MediaProgress.finish(bubbleId, data.message);
                UploadETA.finish(bubbleId);
                // ✅ Remove file from IndexedDB after completion
const request = indexedDB.open('UploadDB', 1);
request.onsuccess = function(e) {
    const db = e.target.result;
    const tx = db.transaction(['files'], 'readwrite');
    const store = tx.objectStore('files');
    store.delete(upload_uuid);
    store.delete(upload_uuid + '_caption');
};
        
            }).catch(err => {
                console.error('finishUpload failed', err);
                delete window.finishLocks[upload_uuid];
                clearLock(upload_uuid);
            });
        } // finishUpload

    }; // return API
})(); 

// ...existing code...