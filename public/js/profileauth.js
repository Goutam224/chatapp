document.addEventListener("DOMContentLoaded", function () {

    const form = document.querySelector("form");
    if (!form) return;

    const button = form.querySelector("button");
    const fileInput = document.getElementById("profile_photo");
    const preview = document.getElementById("photoPreview");

    if (fileInput) {

        fileInput.addEventListener("change", function () {

            const file = this.files[0];
            if (!file) return;

            if (!file.type.startsWith("image/")) {
                alert("Only image files allowed.");
                this.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = function (e) {
                preview.src = e.target.result;
            };

            reader.readAsDataURL(file);

        });

    }

    form.addEventListener("submit", function (e) {

        e.preventDefault();

        button.disabled = true;
        button.innerText = "Saving...";

        const formData = new FormData(form);

        $.ajax({

            url: form.action,
            method: form.method,
            data: formData,

            processData: false,
            contentType: false,

            headers: {
                'X-CSRF-TOKEN': document
                    .querySelector('meta[name="csrf-token"]')
                    .getAttribute('content')
            },

            success: function (response) {

                if (response.success && response.redirect) {
                    window.location.href = response.redirect;
                } else if (response.message) {
                    alert(response.message);
                }

                button.disabled = false;
                button.innerText = "Save";
            },

            error: function (error) {

                console.error(error);

                alert("Server error. Please try again.");

                button.disabled = false;
                button.innerText = "Save";

            }

        });

    });

});
