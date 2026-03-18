window.MediaDownloader = {
  activeDownloads: {},
render(msg) {

    if (!msg.media) return '';

    const isMine = msg.sender_id == window.AUTH_USER_ID;

    // ✅ Sender OR already downloaded → always show preview
    if (isMine || msg.downloaded == 1) {
        return this.renderPreviewFromURL(
            '/media/' + msg.id,
            msg.type,
            msg.media.file_size,
            msg.sender_id,
            msg.media.file_name,
            msg.message ?? null          // ← caption
        );
    }

    // ✅ Receiver, not yet downloaded → show download UI
    return this.renderDownloadUI(msg);
},

  renderDownloadUI(msg) {
 const isMine = msg.sender_id == window.AUTH_USER_ID;

    // ✅ Sender should NEVER see download UI
    if (isMine) {
        return this.renderPreviewFromURL(
            '/media/' + msg.id,
            msg.type,
            msg.media.file_size
        );
    }
   let sizeText;

if (msg.media.file_size < 1024 * 1024) {
    sizeText = (msg.media.file_size / 1024).toFixed(1) + " KB";
} else {
    sizeText = (msg.media.file_size / (1024*1024)).toFixed(1) + " MB";
}
    const thumb = msg.media.thumbnail_path
    ? '/media/thumb/' + msg.id
    : null;

// ✅ Document/file type — WhatsApp row style
if(msg.type === 'document' || msg.type === 'file') {
    const fileName = msg.media.file_name ?? ('File • ' + sizeText);
    const ext = fileName.split('.').pop().toUpperCase();
    return `
       <div style="width:260px;">
       <div class="wa-media-box wa-doc"
             data-id="${msg.id}"
             data-size="${msg.media.file_size}"
             data-caption="${msg.message ? msg.message.replace(/"/g,'&quot;') : ''}">
          <div style="width:40px;height:48px;background:#1d282f;border-radius:6px;
            display:flex;align-items:center;justify-content:center;
            flex-shrink:0;font-size:10px;font-weight:700;color:#25D366;">
    ${ext}
</div>
<div style="flex:1;min-width:0;">
    <div style="color:#e9edef;font-size:13px;font-weight:500;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${fileName}
    </div>
    <div style="color:#8696a0;font-size:11px;margin-top:2px;">
        ${ext} • ${sizeText}
    </div>
</div>
          <div class="wa-download-circle"
                 onclick="MediaDownloader.download(${msg.id}, '${msg.type}', this)"
                 style="position:relative;top:auto;left:auto;transform:none;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
                <svg width="48" height="48" viewBox="0 0 48 48" style="cursor:pointer;">
                    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                    <circle cx="24" cy="24" r="20" stroke="#25D366" stroke-width="3"
                        fill="none"
                        stroke-dasharray="126"
                        stroke-dashoffset="126"
                        stroke-linecap="round"
                        transform="rotate(-90 24 24)"
                        class="wa-ring-progress"/>
                    <polyline points="24,16 24,30" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    <polyline points="17,24 24,31 31,24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
            </div>
    </div>
        ${msg.message ? `<div class="wa-caption">${escapeHtml(msg.message)}</div>` : ''}
       </div>
    `;
}

if(msg.type === 'audio') {
return `
        <div style="width:260px;display:block;"
             data-caption="${msg.message ? msg.message.replace(/"/g,'&quot;') : ''}">
            <div class="wa-audio-box"
                 data-id="${msg.id}"
                 data-size="${msg.media.file_size}"
                 style="width:260px;height:68px;display:flex;align-items:center;gap:12px;padding:12px;box-sizing:border-box;background:#111b21;border-radius:${msg.message ? '10px 10px 10px 10px' : '10px'};">
                <div style="width:44px;height:44px;background:#1d282f;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#25D366;font-size:18px;flex-shrink:0;">
                    🎵
                </div>
            <div style="flex:1;">
    <div style="height:4px;background:#2a3942;border-radius:4px;margin-bottom:6px;"></div>
    <div style="font-size:12px;color:#8696a0;">${sizeText}</div>
    <div class="wa-speed-text" style="font-size:11px;color:#8696a0;margin-top:3px;display:none;white-space:nowrap;"></div>
</div>
             <div class="wa-download-circle"
     onclick="MediaDownloader.download(${msg.id}, 'audio', this)"
     style="position:relative;transform:none;top:auto;left:auto;flex-shrink:0;width:48px;height:48px;">
    <svg viewBox="0 0 48 48" width="48" height="48" style="cursor:pointer;">
        <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.15)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
        <circle cx="24" cy="24" r="20" stroke="#25D366" stroke-width="3"
            fill="none"
            stroke-dasharray="126"
            stroke-dashoffset="126"
            stroke-linecap="round"
            transform="rotate(-90 24 24)"
            class="wa-ring-progress"/>
        <polyline points="24,16 24,30" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <polyline points="17,24 24,31 31,24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
</div>
            </div>
            ${msg.message ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(msg.message)}</div>` : ''}
        </div>
    `;
}

return `
        <div style="width:260px;display:block;line-height:0;">
            <div class="wa-media-box"
                 data-id="${msg.id}"
                 data-size="${msg.media.file_size}"
                 data-caption="${msg.message ? msg.message.replace(/"/g,'&quot;') : ''}"
                 style="width:260px;height:180px;position:relative;border-radius:${msg.message ? '10px 10px 10px 10px' : '10px'};overflow:hidden;">
                
                ${ thumb ? `<img src="${thumb}" class="wa-thumb-bg blurred">` : '<div style="width:100%;height:100%;background:#1d282f;"></div>' }

                <div class="wa-download-circle"
                     onclick="MediaDownloader.download(${msg.id}, '${msg.type}', this)">
                    <svg viewBox="0 0 48 48" width="48" height="48" style="cursor:pointer;">
                        <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.25)" stroke-width="3" fill="rgba(0,0,0,0.35)"/>
                        <circle cx="24" cy="24" r="20" stroke="#25D366" stroke-width="3"
                            fill="none"
                            stroke-dasharray="126"
                            stroke-dashoffset="126"
                            stroke-linecap="round"
                            transform="rotate(-90 24 24)"
                            class="wa-ring-progress"/>
                        <polyline points="24,16 24,30" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                        <polyline points="17,24 24,31 31,24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                </div>

                <div style="position:absolute;bottom:8px;left:8px;display:flex;flex-direction:column;gap:3px;">
                    <span class="wa-size-text" style="font-size:11px;color:white;font-weight:500;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:6px;backdrop-filter:blur(4px);">${sizeText}</span>
                    <span class="wa-speed-text" style="font-size:11px;color:white;background:rgba(0,0,0,0.55);padding:2px 7px;border-radius:6px;backdrop-filter:blur(4px);display:none;"></span>
                </div>

            </div>
            ${msg.message ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(msg.message)}</div>` : ''}
        </div>
    `;
},
download(messageId, type, element) {
const box = element.closest('.wa-media-box') ?? element.closest('.wa-audio-box');
const captionText = box.dataset.caption
    ?? box.closest('[data-caption]')?.dataset.caption
    ?? null;
const outerWrapper = (
    box.parentElement?.style?.width === '260px' ||
    box.parentElement?.dataset?.caption !== undefined
) ? box.parentElement : box;
    const progressCircle = box.querySelector('.wa-ring-progress');
    const circle = element.closest('.wa-download-circle');
    const totalBytes = parseInt(box.dataset.size);
    const csrf = $('meta[name="csrf-token"]').attr('content');

    // 🔁 IF ALREADY DOWNLOADING → PAUSE
    if (this.activeDownloads[messageId]) {
        
        this.activeDownloads[messageId].paused = true;
        delete this.activeDownloads[messageId];
        DownloadSpeed.stop(messageId);
        // restore down arrow
      // restore down arrow (paused state — show resume arrow)
    const svgEl = circle ? circle.querySelector('svg') : null;
        if(progressCircle) {
            progressCircle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease';
            progressCircle.style.stroke = '#8696a0';
        }
        if(svgEl) {
            svgEl.querySelectorAll('polyline, rect').forEach(p => p.remove());
            const downLine = document.createElementNS('http://www.w3.org/2000/svg','polyline');
            downLine.setAttribute('points','24,16 24,30');
            downLine.setAttribute('stroke','white');
            downLine.setAttribute('stroke-width','2.5');
            downLine.setAttribute('stroke-linecap','round');
            downLine.setAttribute('fill','none');
            const downArrow = document.createElementNS('http://www.w3.org/2000/svg','polyline');
            downArrow.setAttribute('points','17,24 24,31 31,24');
            downArrow.setAttribute('stroke','white');
            downArrow.setAttribute('stroke-width','2.5');
            downArrow.setAttribute('stroke-linecap','round');
            downArrow.setAttribute('stroke-linejoin','round');
            downArrow.setAttribute('fill','none');
         svgEl.appendChild(downLine);
            svgEl.appendChild(downArrow);
        }
        if(progressCircle) {
            progressCircle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease';
            progressCircle.style.stroke = '#25D366';
        }
        return;
    }

    // show pause icon (two vertical bars)
    const svg = circle ? circle.querySelector('svg') : null;
  if(svg) {
        svg.querySelectorAll('polyline, rect').forEach(p => p.remove());
        const bar1 = document.createElementNS('http://www.w3.org/2000/svg','rect');
        bar1.setAttribute('x','20'); bar1.setAttribute('y','18');
        bar1.setAttribute('width','3'); bar1.setAttribute('height','12');
        bar1.setAttribute('fill','white'); bar1.setAttribute('rx','1.5');
        const bar2 = document.createElementNS('http://www.w3.org/2000/svg','rect');
        bar2.setAttribute('x','25'); bar2.setAttribute('y','18');
        bar2.setAttribute('width','3'); bar2.setAttribute('height','12');
        bar2.setAttribute('fill','white'); bar2.setAttribute('rx','1.5');
        svg.appendChild(bar1);
        svg.appendChild(bar2);
    }

    $.ajax({
        url: '/download/start',
        method: 'POST',
        contentType: 'application/json',
        headers: { 'X-CSRF-TOKEN': csrf },
        data: JSON.stringify({
            message_id: messageId,
            total_bytes: totalBytes
        }),
        success: (session) => {
if (session.completed == 1) {
outerWrapper.outerHTML =
    MediaDownloader.renderPreviewFromURL(
        '/media/' + messageId,
        type,
        totalBytes,
        window.AUTH_USER_ID,
        null,
        captionText
    );
                    return;
        }

            let downloaded = session.downloaded_bytes || 0;
            DownloadSpeed.start(messageId, downloaded);
            const chunkSize = 1024 * 1024;
            const total = totalBytes;

            // REGISTER ACTIVE DOWNLOAD
            MediaDownloader.activeDownloads[messageId] = {
                paused: false
            };

            const downloadChunk = () => {

                // 🛑 STOP IF PAUSED
                if (!MediaDownloader.activeDownloads[messageId]) {
                    return;
                }

                let end = downloaded + chunkSize - 1;
                if (end >= total) end = total - 1;

                fetch('/media/' + messageId, {
                    headers: {
                        Range: 'bytes=' + downloaded + '-' + end
                    }
                })
                .then(res => res.blob())
                .then(blob => {

                    downloaded += blob.size;
const stats = DownloadSpeed.update(messageId, downloaded, total);

if (stats) {

    const speedEl = box.querySelector('.wa-speed-text');

    if (speedEl) {

        let etaText;

       if (stats.etaSeconds > 60) {
    etaText = Math.ceil(stats.etaSeconds / 60) + " min left";
} else {
    etaText = Math.ceil(stats.etaSeconds) + " sec left";
}

       speedEl.style.display = 'block';
        speedEl.innerText = stats.speedMB + " MB/s • " + etaText;
    }
}// VISUAL PROGRESS
                    const percent = downloaded / total;
                    const circumference = 2 * Math.PI * 20;
                    progressCircle.style.strokeDasharray = circumference;
                    progressCircle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    progressCircle.style.strokeDashoffset = circumference - (percent * circumference);

                    $.ajax({
                        url: '/download/progress',
                        method: 'POST',
                        contentType: 'application/json',
                        headers: { 'X-CSRF-TOKEN': csrf },
                        data: JSON.stringify({
                            message_id: messageId,
                            downloaded_bytes: downloaded
                        })
                    });

                    if (downloaded < total) {
                        downloadChunk();
                    } else {

                        delete MediaDownloader.activeDownloads[messageId];

                        $.ajax({
                            url: '/download/complete',
                            method: 'POST',
                            contentType: 'application/json',
                            headers: { 'X-CSRF-TOKEN': csrf },
                            data: JSON.stringify({
                                message_id: messageId
                            })
                        });
DownloadSpeed.stop(messageId);
outerWrapper.outerHTML =
    MediaDownloader.renderPreviewFromURL(
        '/media/' + messageId,
        type,
        totalBytes,
        window.AUTH_USER_ID,
        null,
        captionText
    );

// ✅ Update media grid item instantly
const gridItem = document.querySelector(
    `.media-grid-item[data-url="/media/${messageId}"]`
);
if(gridItem){
    const gridImg = gridItem.querySelector('.grid-thumb');
    const gridOverlay = gridItem.querySelector('.grid-download-overlay');
    if(gridImg) gridImg.classList.remove('blurred');
    if(gridOverlay) gridOverlay.remove();
}


                    }

                });
            };

            downloadChunk();
        }
    });
},
    renderPreview(msg) {

        return this.renderPreviewFromURL('/media/' + msg.id, msg.type);
    },

renderPreviewFromURL(url, type, fileSizeBytes = null, senderId = null, fileName = null, caption = null) {

    let sizeHtml = '';

    if (fileSizeBytes) {

        let sizeText;

        if (fileSizeBytes < 1024 * 1024) {
            sizeText = (fileSizeBytes / 1024).toFixed(1) + " KB";
        } else {
            sizeText = (fileSizeBytes / (1024*1024)).toFixed(1) + " MB";
        }

     sizeHtml = `
            <div class="wa-media-size"
                 style="position:absolute;bottom:8px;left:8px;
                        font-size:11px;color:white;font-weight:500;
                        background:rgba(0,0,0,0.55);padding:2px 7px;
                        border-radius:6px;backdrop-filter:blur(4px);
                        -webkit-backdrop-filter:blur(4px);">
                ${sizeText}
            </div>
        `;
    }
if(type === 'image') {
    return `
        <div style="width:260px;display:block;line-height:0;">
            <div class="wa-media-box"
                 data-media-view
                 data-url="${url}"
                 data-type="image"
                 data-sender="${senderId ?? window.AUTH_USER_ID}"
                 style="width:260px;height:180px;cursor:pointer;padding:0;display:block;border-radius:${caption ? '10px 10px 10px 10px' : '10px'};overflow:hidden;">
                <img src="${url}"
                     class="wa-media-preview"
                     loading="lazy"
                     decoding="async"
                     style="width:100%;height:100%;object-fit:cover;display:block;">
                ${sizeHtml}
            </div>
            ${caption ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(caption)}</div>` : ''}
        </div>
    `;
}

if(type === 'video') {
    return `
        <div style="width:260px;display:block;line-height:0;">
            <div class="wa-media-box"
                 data-media-view
                 data-url="${url}"
                 data-type="video"
                 data-sender="${senderId ?? window.AUTH_USER_ID}"
                 style="width:260px;height:180px;cursor:pointer;padding:0;display:block;border-radius:${caption ? '10px 10px 10px 10px' : '10px'};overflow:hidden;">
                <video class="wa-media-preview" style="width:100%;height:100%;object-fit:cover;display:block;">
                    <source src="${url}">
                </video>
                <div class="wa-play-icon">▶</div>
                ${sizeHtml}
            </div>
            ${caption ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(caption)}</div>` : ''}
        </div>
    `;
}
if(type === 'audio') {
    return `
        <div style="width:260px;display:block;">
            <div style="display:flex;align-items:center;gap:12px;padding:12px;height:68px;box-sizing:border-box;background:#111b21;border-radius:${caption ? '10px 10px 10px 10px' : '10px'};">
                <div style="width:44px;height:44px;background:#1d282f;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#25D366;font-size:18px;cursor:pointer;flex-shrink:0;"
                     onclick="(function(el){const a=el.closest('div[style]').querySelector('audio');if(a)a.paused?a.play():a.pause();})(this)">
                    ▶
                </div>
                <div style="flex:1;min-width:0;">
                    <audio style="display:none;"><source src="${url}"></audio>
                    <div style="height:3px;background:#2a3942;border-radius:4px;margin-bottom:6px;"></div>
                    <div style="font-size:12px;color:#8696a0;">
                        ${fileSizeBytes ? (fileSizeBytes < 1024*1024 ? (fileSizeBytes/1024).toFixed(1)+' KB' : (fileSizeBytes/(1024*1024)).toFixed(1)+' MB') : ''}
                    </div>
                </div>
            </div>
            ${caption ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:0 0 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(caption)}</div>` : ''}
        </div>
    `;
}

if(type === 'document' || type === 'file') {
    const displayName = fileName ?? url.split('/').pop();
    const ext = displayName.split('.').pop().toUpperCase();
    const sizeLabel = fileSizeBytes
        ? (fileSizeBytes < 1024*1024
            ? (fileSizeBytes/1024).toFixed(1) + ' KB'
            : (fileSizeBytes/(1024*1024)).toFixed(1) + ' MB')
        : '';
    const isSender = senderId == window.AUTH_USER_ID;
    return `
        <div style="width:260px;display:block;">
            <div class="wa-media-box wa-doc"
                 onclick="window.open('${url}', '_blank')"
                 style="cursor:pointer;border-radius:${caption ? '10px 10px 10px 10px' : '10px'};padding:12px 14px;gap:12px;">
                <div style="width:40px;height:48px;background:#1d282f;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:700;color:#25D366;">
                    ${ext}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="color:#e9edef;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${displayName}
                    </div>
                    <div style="color:#8696a0;font-size:11px;margin-top:4px;">
                        ${ext} • ${sizeLabel}
                    </div>
                </div>
               
            </div>
            ${caption ? `<div class="wa-caption" style="line-height:1.45;background:#005c4b;border-radius:10px 10px 10px 10px;padding:6px 10px 4px 10px;">${escapeHtml(caption)}</div>` : ''}
        </div>
    `;
}

 return `
        <div class="wa-media-box wa-doc"
             onclick="window.open('${url}', '_blank')">
            <span style="font-size:32px;">📄</span>
            <div style="display:flex;flex-direction:column;flex:1;">
                <span style="color:#e9edef;font-size:13px;font-weight:500;">Open File</span>
            </div>
            <span style="color:#25D366;font-size:20px;">↗</span>
        </div>
    `;
}

};