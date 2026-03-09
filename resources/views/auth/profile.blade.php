<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/profileauth.css') }}">

    <title>Chat App - Profile Setup</title>
</head>

<body>

<div class="vh-100 d-flex justify-content-center align-items-center">

    <div class="auth-box text-white">

        <div class="text-center mb-4">
            <h5>Setup Your Profile</h5>
        </div>

        <form method="POST" action="{{ route('profile.store') }}" enctype="multipart/form-data">
            @csrf

           <div class="text-center mb-4">
    
    <label for="profile_photo" class="profile-photo-wrapper">
        <img src="{{ $user->profile_photo ? asset($user->profile_photo) : 'https://via.placeholder.com/120' }}"
     id="photoPreview"
     class="profile-photo">

        <div class="camera-overlay">
            📷
        </div>
    </label>

    <input type="file" name="profile_photo" id="profile_photo"
           class="d-none" accept="image/*">

</div>


            <div class="mb-3">
                <label class="form-label">Name *</label>
                <input type="text"
       name="name"
       class="form-control"
       value="{{ old('name', $user->name) }}"
       required>

            </div>

            <div class="mb-3">
                <label class="form-label">About (Optional)</label>
                <input type="text"
       name="about"
       class="form-control"
       value="{{ old('about', $user->about) }}">

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

<script src="{{ asset('js/profileauth.js') }}"></script>

</body>
</html>
