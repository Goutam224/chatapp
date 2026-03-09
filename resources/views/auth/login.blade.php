<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <title>Chat App - Login</title>
   <link rel="stylesheet" href="{{ asset('css/loginauth.css') }}">

</head>
<body>

<div class="vh-100 d-flex justify-content-center align-items-center">
    
    <div class="auth-box text-white">
        <div class="text-center mb-4">
            <div class="logo">Chat App</div>
            <small>Enter your phone number</small>
        </div>

        <form id="phoneForm">
            <div class="mb-3">
                <label class="form-label">Phone Number</label>
                <input type="text" id="phone" class="form-control" placeholder="+91XXXXXXXXXX">
            </div>

            <div class="d-grid">
                <button type="submit" class="btn btn-whatsapp">
                    Continue
                </button>
            </div>
        </form>
    </div>

</div>
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="{{ asset('js/loginauth.js') }}"></script>

</body>

</html>
