<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
   <link rel="stylesheet" href="{{ asset('css/verifyphoneauth.css') }}">

    <title>Chat App - Verify</title>
</head>
<body>

<div class="vh-100 d-flex justify-content-center align-items-center">

    <div class="auth-box text-white">

        <div class="text-center mb-4">
            <h5>Verify Phone</h5>
            <small>Enter the 6 digit OTP</small>
        </div>

        <form id="verifyForm">
            <div class="mb-3 d-flex justify-content-between gap-2">
                <input type="text" maxlength="1" class="form-control otp-box" required>
                <input type="text" maxlength="1" class="form-control otp-box" required>
                <input type="text" maxlength="1" class="form-control otp-box" required>
                <input type="text" maxlength="1" class="form-control otp-box" required>
                <input type="text" maxlength="1" class="form-control otp-box" required>
                <input type="text" maxlength="1" class="form-control otp-box" required>
            </div>

            <div class="text-center mb-3">
                <small id="timer">Resend OTP in 60s</small>
            </div>

            <div class="d-grid">
                <button id="verifyBtn" class="btn btn-whatsapp">
                    Verify
                </button>
            </div>
        </form>

    </div>

</div>
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

<script src="{{ asset('js/verifyphone.js') }}"></script>
</body>

</html>
