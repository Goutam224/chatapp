<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;

class MyProfileController extends Controller
{

    public function get()
    {

        $user = User::find(session('auth_user_id'));

        return response()->json($user);

    }


    public function update(Request $request)
    {

        $user = User::find(session('auth_user_id'));

        $user->name = $request->name;

        $user->about = $request->about;

        $user->save();

        return response()->json([
            'success' => true
        ]);

    }


    public function updatePhoto(Request $request)
    {

        $user = User::find(session('auth_user_id'));

        if($request->hasFile('photo')){

            $file = $request->file('photo');

            $path = 'uploads/profile/' .
                time() . '.' .
                $file->getClientOriginalExtension();

            $file->move(public_path('uploads/profile'), $path);

            $user->profile_photo = $path;

            $user->save();

        }

        return response()->json([
            'photo' => asset($user->profile_photo)
        ]);

    }

}
