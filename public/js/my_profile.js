window.MyProfile = {

open: function()
{

    fetch('/my/profile')

    .then(res => res.json())

    .then(user => {

        document.getElementById('my-name').value =
            user.name;

        document.getElementById('my-about').value =
            user.about ?? '';

        document.getElementById('my-phone').value =
            user.phone;

        document.getElementById('my-profile-photo').src =
            user.profile_photo ?? '/default.png';

        document.getElementById('my-profile-panel')
            .classList.add('open');

    });

},


close: function()
{

    document.getElementById('my-profile-panel')
        .classList.remove('open');

},


save: function()
{

    fetch('/my/profile/update', {

        method:'POST',

        headers:{
            'Content-Type':'application/json',
            'X-CSRF-TOKEN':
            document.querySelector(
            'meta[name="csrf-token"]').content
        },

        body: JSON.stringify({

            name:
            document.getElementById('my-name').value,

            about:
            document.getElementById('my-about').value

        })

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

        document.getElementById(
            'my-profile-photo').src =
            data.photo;

    });

}

};


document.getElementById('my-photo-input')
.addEventListener('change', function(){

    MyProfile.uploadPhoto(this.files[0]);

});
