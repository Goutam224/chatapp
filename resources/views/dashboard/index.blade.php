<!DOCTYPE html>
<html>
<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="csrf-token" content="{{ csrf_token() }}">

<title>Chat App Home</title>

<link rel="stylesheet" href="{{ asset('css/dashboard.css') }}">
<link rel="stylesheet"
href="{{ asset('css/profile_panel.css') }}">
<link rel="stylesheet" href="{{ asset('css/chat.css') }}">

<link rel="stylesheet"
href="{{ asset('css/my_profile_panel.css') }}">
<link rel="stylesheet" href="{{ asset('css/media_download.css') }}">
<link rel="stylesheet" href="{{ asset('css/media_viewer.css') }}">
<link rel="stylesheet" href="{{ asset('css/reply_message.css') }}">
<link rel="stylesheet" href="{{ asset('css/context_menu.css') }}">
<link rel="stylesheet" href="{{ asset('css/message_info.css') }}">
<link rel="stylesheet" href="{{ asset('css/message_pin.css') }}">
<link rel="stylesheet" href="{{ asset('css/starred_messages.css') }}">
<link rel="stylesheet" href="{{ asset('css/clear_chat.css') }}">
<link rel="stylesheet" href="{{ asset('css/chat_search.css') }}">
<link rel="stylesheet" href="{{ asset('css/pin_chat.css') }}">


<link href="https://releases.transloadit.com/uppy/v3.25.0/uppy.min.css" rel="stylesheet">
<link rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>

<body>

<div class="app">

    <!-- Sidebar -->
    <div class="sidebar">

        <div class="sidebar-header">

          <img src="{{ $user->profile_photo ?? '/default.png' }}"
class="profile-img"
onclick="MyProfile.open()"
style="cursor:pointer;">


            <div class="header-icons">
               <button id="new-chat-btn">+</button>
                <button>⋮</button>
            </div>

        </div>

       <div class="search-box">
    <input type="text" id="chat-search-input" placeholder="Search chats">
</div>

<div class="chat-filters">

<button class="chat-filter active" data-filter="all">
All
</button>

<button class="chat-filter" data-filter="unread">
Unread <span id="unread-count"></span>
</button>

</div>

<div id="chat-search-results"></div>

<div id="new-chat-list" style="display:none;"></div>
    <div class="chat-list">

@foreach($chats as $chat)
@if(!$chat->messages->count())
@continue
@endif
@php
$otherUser = $chat->participants
    ->where('user_id', '!=', session('auth_user_id'))
    ->first()
    ->user ?? null;

$lastMessage = $chat->messages->first();
@endphp
@php
$authId = session('auth_user_id');

$clearTime = \App\Models\ClearedChat::where('chat_id',$chat->id)
    ->where('user_id',$authId)
    ->value('cleared_at');

$unreadQuery = \App\Models\Message::where('chat_id', $chat->id)
    ->where('sender_id', '!=', $authId)
    ->whereNull('seen_at')
    ->where(function($q) use ($authId){
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', $authId);
    });

if($clearTime){
    $unreadQuery->where('created_at','>',$clearTime);
}

$unreadCount = $unreadQuery->count();
@endphp
<div class="chat-item"
     data-chat-id="{{ $chat->id }}"
     data-user-id="{{ $otherUser->id }}"
     data-unread="{{ $unreadCount }}"
     data-pinned="{{ in_array($chat->id, $pinnedChatIds) ? '1' : '0' }}">
@php
$authId = session('auth_user_id');

// Check ONLY if other user blocked me
$isBlockedBy = \App\Models\UserBlock::where('blocker_id', $otherUser->id)
    ->where('blocked_id', $authId)
    ->exists();

$photo = $isBlockedBy
    ? '/default.png'
    : ($otherUser->profile_photo ?? '/default.png');
@endphp

<img src="{{ url($photo) }}" class="chat-img">

    <div class="chat-info">
<div class="chat-name">

<span class="chat-title">
{{ $otherUser->name ?? 'Unknown User' }}
</span>

<span class="chat-pin-icon" >📌</span>

</div>

      <div class="chat-last">
@php
$authId = session('auth_user_id');

$clearTime = \App\Models\ClearedChat::where('chat_id',$chat->id)
    ->where('user_id',$authId)
    ->value('cleared_at');

$visibleMessage = $chat->messages
    ->filter(function($msg) use ($authId,$clearTime){

        // ✅ Hide messages before clear chat
        if($clearTime && $msg->created_at <= $clearTime){
            return false;
        }

        // ❌ Hide block/unblock system messages
        if(
            $msg->message === 'You blocked this contact.' ||
            $msg->message === 'You unblocked this contact.'
        ){
            return false;
        }

        // ✅ Respect visible_to restriction
        if($msg->visible_to && !in_array($authId, $msg->visible_to)){
            return false;
        }

        // ✅ Respect delete-for-me
        if($msg->deleted_for_users &&
           in_array($authId, $msg->deleted_for_users)){
            return false;
        }

        return true;

    })
    ->sortByDesc('created_at')
    ->first();
@endphp


@php
$authId = session('auth_user_id');
$sidebarBlockTime = null;
if($visibleMessage && $otherUser){
    $sidebarBlock = \App\Models\UserBlock::where(function($q) use ($authId, $otherUser){
        $q->where(function($q2) use ($authId, $otherUser){
            $q2->where('blocker_id', $authId)
               ->where('blocked_id', $otherUser->id);
        })->orWhere(function($q2) use ($authId, $otherUser){
            $q2->where('blocker_id', $otherUser->id)
               ->where('blocked_id', $authId);
        });
    })->orderBy('created_at','asc')->first();
    $sidebarBlockTime = $sidebarBlock?->created_at;
}
@endphp

@php
$sidebarText = '';
if($visibleMessage) {
    if($visibleMessage->deleted_for_everyone) {
        $sidebarText = 'This message was deleted';
    } elseif(
        $sidebarBlockTime &&
        $visibleMessage->edited_at &&
        $visibleMessage->sender_id != $authId &&
        $visibleMessage->edited_at > $sidebarBlockTime &&
        !is_null($visibleMessage->original_message)
    ) {
        $sidebarText = $visibleMessage->original_message;
    } elseif($visibleMessage->message) {
        $sidebarText = $visibleMessage->message;
    } elseif($visibleMessage->media) {
        $mime = $visibleMessage->media->mime_type ?? '';
        if(str_starts_with($mime, 'image')) $sidebarText = '📷 Photo';
        elseif(str_starts_with($mime, 'video')) $sidebarText = '🎥 Video';
        elseif(str_starts_with($mime, 'audio')) $sidebarText = '🎵 Audio';
        else $sidebarText = '📄 ' . ($visibleMessage->media->file_name ?? 'Document');
    }
}
@endphp
{{ $sidebarText }}</div>


    </div>

<div class="chat-time"
     data-time="{{ $visibleMessage ? $visibleMessage->created_at : '' }}">

    <div class="time-text">
        {{ $visibleMessage ? $visibleMessage->created_at->format('g:i A') : '' }}
    </div>

    @if($unreadCount > 0)
        <div class="unread-count">{{ $unreadCount }}</div>
    @endif

</div>

</div>

@endforeach

</div>

@include('dashboard.partials.my_profile_panel')

    </div>

<div class="chat-area">

<div id="chat-container">

@if(isset($page) && $page === 'starred')

    @yield('content')

@else

        <!-- Chat Header -->
        <div class="chat-header" style="display:flex;align-items:center;padding:10px;">

            <div style="display:flex;flex-direction:column;">

                <span id="chat-user-name"
                      onclick="ProfilePanel.open()"
                      style="cursor:pointer;">
                    Select Chat
                </span>

                <span id="chat-status"
                      style="font-size:12px;color:#8696a0;">
                </span>

            </div>

        </div>

        <!-- Chat Messages -->
        <div id="chat-messages"></div>

        <!-- Typing Indicator -->
        <div id="typing-indicator"
             style="font-size:13px;color:#25D366;padding-left:10px;">
        </div>

@endif

</div>

</div>
</div>
<div id="media-viewer-modal" class="media-viewer-modal">

    <div class="media-viewer-close" onclick="MediaViewer.close()">✕</div>

    <div class="media-viewer-download"
         onclick="window.open(document.querySelector('.mv-media').src, '_blank')">
         ⬇
    </div>

    <!-- LEFT NAV -->
    <div class="media-viewer-nav left" onclick="MediaViewer.prev()">
        ❮
    </div>

    <!-- RIGHT NAV -->
    <div class="media-viewer-nav right" onclick="MediaViewer.next()">
        ❯
    </div>

    <div id="media-viewer-content"></div>

</div>

<!-- MESSAGE INFO PANEL -->
<div id="message-info-panel">

    <div class="mi-header">
        <span>Message info</span>
        <button onclick="MessageInfo.close()">✕</button>
    </div>
<div id="mi-preview" class="mi-preview">

    <div class="mi-preview-bg">

        <div id="mi-preview-date" class="mi-preview-date"></div>

        <div id="mi-preview-bubble" class="mi-bubble">
            <div id="mi-preview-content"></div>

            <div class="mi-preview-meta">
                <span id="mi-preview-time"></span>
                <span class="mi-preview-ticks">✔✔</span>
            </div>
        </div>

    </div>

</div>
    <div class="mi-content">

        <div class="mi-section">
            <div class="mi-row">
                <span class="mi-icon blue">✔✔</span>
                <div>
                    <div class="mi-title">Read</div>
                    <div id="mi-read-time" class="mi-time"></div>
                </div>
            </div>
        </div>

        <div class="mi-section">
            <div class="mi-row">
                <span class="mi-icon grey">✔✔</span>
                <div>
                    <div class="mi-title">Delivered</div>
                    <div id="mi-delivered-time" class="mi-time"></div>
                </div>
            </div>
        </div>

    </div>

</div>
<script>
window.AUTH_USER_ID = {{ session('auth_user_id') }};
window.APP_PAGE = "{{ $page ?? 'chat' }}";   // ⭐ ADD THIS

// ✅ Listen for block/unblock events instantly
document.addEventListener('DOMContentLoaded', function(){
    ChatSystem.listenUserChannel(window.AUTH_USER_ID);
});

window.blockedByUsers = @json(
    \App\Models\UserBlock::where('blocked_id', session('auth_user_id'))
        ->pluck('blocker_id')
        ->toArray()
);

window.iBlockedUsers = @json(
    \App\Models\UserBlock::where('blocker_id', session('auth_user_id'))
        ->pluck('blocked_id')
        ->toArray()
);
</script>
<script src="https://cdn.jsdelivr.net/npm/pusher-js@8.4.0/dist/web/pusher.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/laravel-echo@1.16.0/dist/echo.iife.js"></script>
<script src="https://releases.transloadit.com/uppy/v3.25.0/uppy.min.js"></script>

<script src="{{ asset('js/echo.js') }}"></script>

<script src="{{ asset('js/listeners.js') }}"></script>



<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="{{ asset('js/presence.js') }}"></script>
<script src="{{ asset('js/typing-indicator.js') }}"></script>
<script src="{{ asset('js/message_edit.js') }}"></script>
<script src="{{ asset('js/context_menu.js') }}"></script>
<script src="{{ asset('js/message_pin.js') }}"></script>
<script src="{{ asset('js/message_star.js') }}"></script>
<script src="{{ asset('js/dashboard.js') }}"></script>
<script src="/js/media_progress.js"></script>
<script src="/js/media_uploadspeed.js"></script>
<script src="/js/media_upload.js"></script>
<script src="/js/resumable_upload.js"></script>
<script src="/js/download_speed.js"></script>
<script src="/js/media_viewer.js"></script>
<script src="/js/clear_chat.js"></script>

<script src="/js/media_download.js"></script>
<script src="{{ asset('js/message_reply.js') }}"></script>
<script src="{{ asset('js/message_info.js') }}"></script>
<script src="{{ asset('js/chat.js') }}"></script>
<script src="/js/chat_filters.js"></script>
<script src="{{ asset('js/profile_panel.js') }}"></script>
<script src="{{ asset('js/my_profile.js') }}"></script>
<script src="{{ asset('js/chat_search.js') }}"></script>
<script src="{{ asset('js/pin_chat.js') }}"></script>
<script src="{{ asset('js/sidebar_context_menu.js') }}"></script>
@include('dashboard.partials.profile_panel')
@include('dashboard.partials.my_profile_panel')

<div id="pin-limit-modal" class="pin-limit-modal">
    <div class="pin-limit-box">
        <div class="pin-limit-title">Pin limit reached</div>
        <div class="pin-limit-text">
            You can only pin up to 3 chats
        </div>
        <button onclick="PinChat.closeLimitModal()">OK</button>
    </div>
</div>

</body>
</html>
