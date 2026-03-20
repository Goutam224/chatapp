/*
|--------------------------------------------------------------------------
| MESSAGE REPLY MODULE
|--------------------------------------------------------------------------
| Extracted from chat.js without changing behaviour
|--------------------------------------------------------------------------
*/

window.replyMessage = null;

/*
|--------------------------------------------------------------------------
| MEDIA LABEL
|--------------------------------------------------------------------------
*/
function getReplyMediaLabel(msg){

    const type = msg.type ?? '';

    if(type === 'image') return '📷 Photo';
    if(type === 'video') return '🎥 Video';
    if(type === 'audio') return '🎤 Audio';
    if(type === 'file') return '📄 Document';

    if(msg.media){
        const mime = msg.media.mime_type ?? '';

        if(mime.startsWith('image')) return '📷 Photo';
        if(mime.startsWith('video')) return '🎥 Video';
        if(mime.startsWith('audio')) return '🎤 Audio';
    }

    return '📎 Media';
}

/*
|--------------------------------------------------------------------------
| SET REPLY
|--------------------------------------------------------------------------
*/
window.setReply = function(messageId){

    const msgEl = document.querySelector(`[data-id="${messageId}"]`);
    if(!msgEl) return;

    const clone = msgEl.cloneNode(true);
    clone.querySelectorAll('.time, .reply-quote').forEach(el => el.remove());

    const mediaBox = msgEl.querySelector('.wa-media-box');

    let text = '';

    if(mediaBox){

        let type = msgEl.dataset.type || '';

        if(!type){
            if(mediaBox.querySelector('video')) type = 'video';
            else if(mediaBox.querySelector('img')) type = 'image';
            else if(mediaBox.querySelector('audio')) type = 'audio';
            else {
                const label = mediaBox.innerText || '';
                if(label.includes('KB') || label.includes('MB') || label.includes('.pdf') || label.includes('.doc')) type = 'file';
            }
        }

        text = getReplyMediaLabel({ type }) || '📎 Media';

    } else {
        text = clone.innerText.trim();
    }

  let thumb = null;

if(mediaBox){

    const img = mediaBox.querySelector('img');
    const video = mediaBox.querySelector('video');

    if(img){
        thumb = {
            type:'image',
            src: img.src
        };
    }

    else if(video){
        thumb = {
            type:'video',
            src: video.src
        };
    }
}

window.replyMessage = {
    id: messageId,
    text: text,
    thumb: thumb
};

    const replyBox = document.getElementById('reply-preview');

    if(replyBox) replyBox.style.display = 'flex';

    document.getElementById('reply-user').innerText = 'You';
    document.getElementById('reply-text').innerText = text;

    // focus message input
const input = document.getElementById('message-input');
if(input){
    input.focus();
}
};



/*
|--------------------------------------------------------------------------
| CANCEL REPLY
|--------------------------------------------------------------------------
*/

document.addEventListener('click',function(e){

    if(e.target.id === 'reply-cancel'){

        window.replyMessage = null;

        const replyBox = document.getElementById('reply-preview');

        if(replyBox) replyBox.style.display='none';

    }

});


/*
|--------------------------------------------------------------------------
| REPLY CLICK SCROLL
|--------------------------------------------------------------------------
*/

document.addEventListener('click',function(e){
const quote = e.target.closest('.reply-quote[data-reply-id]');
    if(!quote) return;

    const id = quote.dataset.replyId;

    const msg = document.querySelector(`[data-id="${id}"]`);

    if(msg){

        msg.scrollIntoView({
            behavior:'smooth',
            block:'center'
        });

        msg.classList.add('reply-highlight');

        setTimeout(()=>{
            msg.classList.remove('reply-highlight');
        },2000);

    }

});