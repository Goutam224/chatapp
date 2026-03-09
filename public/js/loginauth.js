const form = document.getElementById('phoneForm');
const button = form.querySelector('button');

form.addEventListener('submit', function(e) {
    e.preventDefault();

    const phone = document.getElementById('phone').value.trim();

    if (!phone.startsWith('+')) {
        alert("Phone must include country code. Example: +91XXXXXXXXXX");
        return;
    }

    button.disabled = true;
    button.innerText = "Sending...";

    $.ajax({
        url: '/send-otp',
        method: 'POST',
        contentType: 'application/json',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
        },
        data: JSON.stringify({ phone: phone }),

        success: function(data) {

            if (data.success) {

                // show OTP in alert (only in fake mode)
                if (data.otp) {
                    alert("Your OTP is: " + data.otp);
                }

                window.location.href = "/verifyphone";
            }
            else {
                alert(data.message);
                button.disabled = false;
                button.innerText = "Continue";
            }
        },

        error: function() {
            alert("Server error. Please try again.");
            button.disabled = false;
            button.innerText = "Continue";
        }
    });

});
