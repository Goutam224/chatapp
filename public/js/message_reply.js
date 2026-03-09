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

    if(msg.type === 'image') return '📷 Photo';
    if(msg.type === 'video') return '🎥 Video';
    if(msg.type === 'audio') return '🎤 Audio';
    if(msg.type === 'file') return '📄 Document';

    return '';
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

    window.replyMessage = {
        id: messageId,
        text: text
    };

    const replyBox = document.getElementById('reply-preview');

    if(replyBox) replyBox.style.display = 'flex';

    document.getElementById('reply-user').innerText = 'You';
    document.getElementById('reply-text').innerText = text;
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