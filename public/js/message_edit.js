window.startEditMessage = function(messageId){

    const msg = document.querySelector(`[data-id="${messageId}"]`);
    if(!msg) return;

    const createdAt = msg.dataset.createdAt;
    if(!createdAt) return;

    const msgTime = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMinutes = (now - msgTime) / (1000 * 60);

    if(diffMinutes > 15){
        alert('You can only edit messages within 15 minutes.');
        return;
    }

    window.editingMessageId = messageId;

    // ✅ Try .msg-content first (loadMessages after refresh)
    // ✅ Fallback: walk childNodes for realtime-built bubbles
  let text = '';

const msgContent = msg.querySelector('.msg-content');
// ⭐ if link preview exists → extract original URL and stop, no further parsing needed
const preview = msg.querySelector('.link-preview');
if(preview && preview.dataset.url){
    text = preview.dataset.url;
} else if(msgContent){
        // built by loadMessages — always has .msg-content wrapper
      text = msgContent.innerHTML
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')   // remove link tags
    .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .trim();
    } else {
        // built by sendMessage/handleMessageSent — no .msg-content wrapper
        const timeDiv = msg.querySelector('.time');
        const hoverArrow = msg.querySelector('.msg-hover-arrow');
        const replyQuote = msg.querySelector('.reply-quote');

        for(const node of msg.childNodes){
            if(node === timeDiv) continue;
            if(node === hoverArrow) continue;
            if(node === replyQuote) continue;
            if(node.nodeType === 3) continue; // skip whitespace
            // found the content element
          text = node.innerHTML
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')   // remove link tags
    .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .trim();
            break;
        }
    }

    if(!text) return;

    const input = document.getElementById('message-input');
    input.value = text;
    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;
};