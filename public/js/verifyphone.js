document.addEventListener("DOMContentLoaded", function () {

    let timer = 60;
    const timerElement = document.getElementById('timer');
    const form = document.getElementById('verifyForm');
    const button = document.getElementById('verifyBtn');
    const inputs = document.querySelectorAll('.otp-box');

    /* =========================
       OTP TIMER
    ========================= */

    const countdown = setInterval(() => {

        timer--;

        if (timerElement) {
            timerElement.innerText = `Resend OTP in ${timer}s`;
        }

        if (timer <= 0) {
            clearInterval(countdown);

            if (timerElement) {
                timerElement.innerHTML = `<a href="#" id="resendOtp">Resend OTP</a>`;
            }
        }

    }, 1000);


  /* =========================
   AUTO FOCUS OTP INPUT + 
========================= */

inputs.forEach((input, index) => {

    // Move forward when typing
    input.addEventListener('input', function () {

        if (this.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }

    });

    // Move backward when pressing backspace
    input.addEventListener('keydown', function (e) {

        if (e.key === "Backspace") {

            // If current box has value → clear it
            if (this.value !== "") {
                this.value = "";
            } 
            // If empty → move to previous box
            else if (index > 0) {
                inputs[index - 1].focus();
                inputs[index - 1].value = "";
            }

        }

    });

});


    /* =========================
       VERIFY OTP
    ========================= */

    if (form) {

        form.addEventListener('submit', function (e) {

            e.preventDefault();

            const otp = Array.from(inputs)
                .map(input => input.value)
                .join('');

            if (otp.length !== 6) {
                alert("Enter valid 6 digit OTP");
                return;
            }

            button.disabled = true;
            button.innerText = "Verifying...";

            $.ajax({

                url: '/verify-otp',

                method: 'POST',

                contentType: 'application/json',

                headers: {
                    'X-CSRF-TOKEN': document
                        .querySelector('meta[name="csrf-token"]')
                        .getAttribute('content')
                },

                data: JSON.stringify({ otp: otp }),

                success: function (data) {

                    if (data.success) {

                        // Redirect based on backend response
                        window.location.href = data.redirect;

                    } else {

                        alert(data.message);

                        button.disabled = false;
                        button.innerText = "Verify";

                    }

                },

                error: function (error) {

                    console.error(error);

                    alert("Server error. Please try again.");

                    button.disabled = false;
                    button.innerText = "Verify";

                }

            });

        });

    }

});
