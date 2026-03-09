<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

<div id="profile-panel" class="profile-panel">

    <div class="profile-header">

        <button onclick="ProfilePanel.close()">←</button>

        <span>Contact info</span>

    </div>

    <div class="profile-body">

        <img id="profile-photo" class="profile-photo">

        <div class="profile-block">

            <div class="label">Name</div>

            <div id="profile-name" class="value"></div>

        </div>

        <div class="profile-block">

            <div class="label">Phone</div>

            <div id="profile-phone" class="value"></div>

        </div>

        <div class="profile-block">

            <div class="label">About</div>

            <div id="profile-about" class="value"></div>

        </div>

        <div class="profile-block">

            <div class="label">Last seen</div>

            <div id="profile-last-seen" class="value"></div>

        </div>

        <div class="profile-block danger-block">
    <button id="blockBtn" class="block-btn"></button>
</div>
    </div>
<div class="profile-block clickable"
     onclick="ProfilePanel.openSharedOverview()"
     style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">

    <span>Media, links and docs</span>

    <div style="display:flex;align-items:center;gap:8px;">
        <span id="shared-count">0</span>
        <span style="color:#8696a0;font-size:18px;">›</span>
    </div>

</div>
<div id="shared-screen" class="shared-screen">

    <div class="profile-header">
        <button onclick="ProfilePanel.closeShared()">←</button>
        <span>Media, links and docs</span>
    </div>

    <div class="profile-tabs">
        <div class="tab active" data-type="media">Media</div>
        <div class="tab" data-type="links">Links</div>
        <div class="tab" data-type="docs">Docs</div>
        <div class="tab" data-type="audio">Audio</div>
    </div>

    <div id="shared-container" class="shared-container"></div>

</div>

<div class="profile-block clickable"
onclick="ProfilePanel.close(); openStarredMessages();"
style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">

<span>Starred messages</span>

<span style="color:#8696a0;font-size:18px;">›</span>

</div>

<div class="profile-block clickable clear-chat-row"
onclick="clearChatConfirm()">

<span>Clear chat</span>
<span class="arrow">›</span>

</div>

<div id="clear-chat-modal" class="cc-modal">

    <div class="cc-box">

        <div class="cc-title">
            Clear chat?
        </div>

        <div class="cc-text">
            Messages will be cleared for you only.<br>
            Starred messages will remain available in Starred messages.
        </div>

        <div class="cc-actions">

            <button id="cc-cancel" class="cc-btn cancel">
                Cancel
            </button>

            <button id="cc-confirm" class="cc-btn danger">
                Clear chat
            </button>

        </div>

    </div>

</div>

</div>
