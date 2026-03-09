<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;

class ProfileController extends Controller
{
  public function create()
{
    $phone = session('auth_phone');

    if (!$phone) {
        return redirect('/login');
    }

    $user = User::where('phone', $phone)->first();

    return view('auth.profile', compact('user'));
}


  public function store(Request $request)
{
    $phone = session('auth_phone');

    if (!$phone) {
        return response()->json([
            'success' => false,
            'redirect' => url('/login')
        ]);
    }

    $request->validate([
        'name' => 'required|string|max:255',
        'about' => 'nullable|string|max:255',
        'profile_photo' => 'nullable|image|mimes:jpg,jpeg,png|max:2048'
    ]);

    $user = User::where('phone', $phone)->firstOrFail();

    if ($request->hasFile('profile_photo')) {

        $file = $request->file('profile_photo');

        $filename = time() . '_' . $file->getClientOriginalName();

        $file->move(public_path('uploads/profile'), $filename);

        $user->profile_photo = 'uploads/profile/' . $filename;
    }

    $user->name = $request->name;
    $user->about = $request->about;
    $user->save();


    return response()->json([
        'success' => true,
        'redirect' => url('/dashboard')
    ]);
}

}