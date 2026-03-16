
let originalChatView = null;
window.MyProfile = {

open: function()
{

fetch('/my/profile')

.then(res => res.json())

.then(user => {

    document.getElementById('my-name').value = user.name;
    document.getElementById('my-about').value = user.about ?? '';
    document.getElementById('my-phone').value = user.phone;

    document.getElementById('my-profile-photo').src =
        user.profile_photo ?? '/default.png';

    const container = document.getElementById('chat-container');

    // save original chat view only once
    if(originalChatView === null){
        originalChatView = container.innerHTML;
    }

    container.innerHTML = `
    <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        height:100%;
        color:#8696a0;
    ">

    <img src="${user.profile_photo ?? '/default.png'}"
         style="width:160px;height:160px;border-radius:50%;object-fit:cover;margin-bottom:20px;">

    <div style="font-size:22px;">
        Profile
    </div>

    </div>
    `;

    document.getElementById('my-profile-panel')
        .classList.add('open');

});

},


close: function()
{

    document.getElementById('my-profile-panel')
        .classList.remove('open');

    const container = document.getElementById('chat-container');

    if(originalChatView !== null){
        container.innerHTML = originalChatView;
    }

},

save: function()
{

fetch('/my/profile/update', {

    method:'POST',

    headers:{
        'Content-Type':'application/json',
        'X-CSRF-TOKEN':
        document.querySelector('meta[name="csrf-token"]').content
    },

    body: JSON.stringify({

        name: document.getElementById('my-name').value,
        about: document.getElementById('my-about').value

    })

}).then(()=>{
    showToast("Profile updated successfully");
});

},

choosePhoto: function()
{

    document.getElementById(
        'my-photo-input').click();

},


uploadPhoto: function(file)
{

    const formData = new FormData();

    formData.append('photo', file);

    fetch('/my/profile/photo', {

        method:'POST',

        headers:{
            'X-CSRF-TOKEN':
            document.querySelector(
            'meta[name="csrf-token"]').content
        },

        body: formData

    })

 .then(res => res.json())

.then(data => {

    document.getElementById('my-profile-photo').src = data.photo;

    // update center profile image
    const centerImg = document.getElementById('center-profile-photo');
    if(centerImg){
        centerImg.src = data.photo;
    }

    // show toast message
    showToast("Profile photo updated");

});

}

};


document.getElementById('my-photo-input')
.addEventListener('change', function(){

    MyProfile.uploadPhoto(this.files[0]);

});

function showToast(message){

    const toast = document.getElementById('wa-toast');

    toast.innerText = message;
    toast.classList.add('show');

    setTimeout(()=>{
        toast.classList.remove('show');
    },2500);

}