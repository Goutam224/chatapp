<!DOCTYPE html>
<html>
<head>

<title>Chat</title>
<link rel="stylesheet" href="{{ asset('css/chat.css') }}">

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
<style>

body{
background:#111b21;
color:white;
}

.sidebar{
height:100vh;
background:#202c33;
}

.chat-area{
height:100vh;
background:#0b141a;
}

</style>

</head>

<body>

<div class="container-fluid">

<div class="row">

<div class="col-4 sidebar">

<h4 class="p-3">Chats</h4>

</div>

<div class="col-8 chat-area d-flex flex-column" style="height:100vh;">

    <!-- Chat Header -->
    <div class="p-3 border-bottom">
        <span id="chat-user-name">Select Chat</span>
    </div>

    <!-- Chat Messages -->
    <div id="chat-messages" style="
        flex:1;
        overflow-y:auto;
        padding:15px;
    ">
    </div>

    <!-- Typing Indicator -->
    <div id="typing-indicator" style="
        height:20px;
        font-size:13px;
        color:#53bdeb;
        padding-left:15px;
    ">
    </div>

    <!-- Chat Input -->
 <!-- Chat Input -->
<div class="p-3 border-top d-flex align-items-center">

    <!-- Hidden file input -->
    <input type="file"
           id="media-input"
           hidden
           onchange="sendMedia()">

    <!-- Attachment button -->
    <button onclick="document.getElementById('media-input').click()"
            class="btn btn-secondary me-2"
            title="Attach file">

        📎

    </button>

    <!-- Message input -->
    <input type="text"
           id="message-input"
           class="form-control me-2"
           placeholder="Type a message">

    <!-- Send button -->
    <button onclick="sendMessage()"
            class="btn btn-success">

        Send

    </button>

</div>


</div>


</div>

</div>

</body>
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="/js/media_progress.js"></script>

<script src="/js/media_upload.js"></script>
<script src="{{ asset('js/chat.js') }}"></script>

</html>

