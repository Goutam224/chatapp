<div id="my-profile-panel" class="wa-profile-panel">

<div class="wa-profile-sidebar">

    <div class="wa-profile-header">
        <button class="wa-back-btn" onclick="MyProfile.close()">←</button>
        <span>Profile</span>
    </div>

    <div class="wa-profile-body">

        <input type="file" id="my-photo-input" hidden>

        <div class="wa-photo-container">
            <img id="my-profile-photo"
                 class="wa-profile-photo"
                 onclick="MyProfile.choosePhoto()">

            <div class="wa-photo-overlay"
                 onclick="MyProfile.choosePhoto()">
                 Change Photo
            </div>
        </div>

        <div class="wa-field">
            <label>Name</label>
            <input id="my-name">
        </div>

        <div class="wa-field">
            <label>About</label>
            <input id="my-about">
        </div>

        <div class="wa-field">
            <label>Phone</label>
            <input id="my-phone" readonly>
        </div>
<button class="wa-save-btn" onclick="MyProfile.save()">
    Save Changes
</button>

    </div>

</div>


</div>
