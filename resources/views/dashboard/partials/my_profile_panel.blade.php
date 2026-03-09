<div id="my-profile-panel" class="profile-panel">

    <div class="profile-header">

        <button onclick="MyProfile.close()">←</button>

        Profile

    </div>


    <div class="profile-body">

        <input type="file"
               id="my-photo-input"
               hidden>

        <img id="my-profile-photo"
             class="profile-photo"
             onclick="MyProfile.choosePhoto()">


        <div class="profile-field">

            <label>Name</label>

            <input id="my-name">

        </div>


        <div class="profile-field">

            <label>About</label>

            <input id="my-about">

        </div>


        <div class="profile-field">

            <label>Phone</label>

            <input id="my-phone"
                   readonly>

        </div>


        <button onclick="MyProfile.save()">
            Save
        </button>

    </div>

</div>
