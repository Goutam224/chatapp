@php
use Illuminate\Support\Str;
@endphp
@extends('dashboard.index')

@section('content')

<div class="chat-header">
  <button onclick="closeStarredMessages()" style="margin-right:10px;">
    ←
</button>
    <span>Starred Messages</span>
</div>

<div class="chat-messages">

@foreach($stars as $star)

<div class="msg msg-left"
     data-id="{{ $star->message->id }}"
     data-created-at="{{ $star->message->created_at }}"
     data-media='@json($star->message->media)'
onclick="openChat({{ $star->message->chat_id }}, document.querySelector('.chat-item[data-chat-id={{ $star->message->chat_id }}]')); setTimeout(()=>scrollToPinnedMessage({{ $star->message->id }}),400);">

<div class="starred-author">
{{ $star->message->sender->name }}
</div>

<div class="msg-content starred-content">
{{ $star->message->message }}
</div>

<div class="time">
⭐ {{ \Carbon\Carbon::parse($star->message->created_at)->format('g:i A') }}
</div>

</div>

@endforeach
</div>

@endsection

<script>

document.addEventListener("DOMContentLoaded", function(){

document.querySelectorAll('.msg').forEach(msg => {

    const media = msg.dataset.media;

    if(!media) return;

    const mediaObj = JSON.parse(media);

    if(!mediaObj) return;

    const content = msg.querySelector('.starred-content');

    if(!content) return;

    const fakeMsg = {
        media: mediaObj,
        message: content.innerText
    };

    content.innerHTML = MediaDownloader.render(fakeMsg);

});

});

</script>