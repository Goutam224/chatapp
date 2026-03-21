<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\OtpVerification;
use Illuminate\Support\Facades\Hash;
use Twilio\Rest\Client;

class AuthController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | SEND OTP
    |--------------------------------------------------------------------------
    */

  public function sendOtp(Request $request)
{
    // use phone from request OR session (for resend)
    $phone = $request->phone ?? session('auth_phone');

    if (!$phone) {
        return response()->json([
            'success' => false,
            'message' => 'Phone not found'
        ], 400);
    }

    $phone = trim($phone);
    $phone = str_replace(' ', '', $phone);

    // store back in session
    session(['auth_phone' => $phone]);


    // Generate secure OTP
    $otp = random_int(100000, 999999);

    OtpVerification::updateOrCreate(
        ['phone' => $phone],
        [
            'otp_hash'   => Hash::make($otp),
            'expires_at' => now()->addMinutes(5),
            'attempts'   => 0,
            'verified_at'=> null
        ]
    );

    // try { this is for real otp verification

    //     $twilio = new Client(
    //         env('TWILIO_SID'),
    //         env('TWILIO_AUTH_TOKEN')
    //     );

    //     $twilio->messages->create(
    //         $phone, 
    //         [
    //             "from" => env('TWILIO_PHONE'),
    //             "body" => "Your Chat App OTP is: $otp"
    //         ]
    //     );

    // } catch (\Exception $e) {

    //     return response()->json([
    //         'success' => false,
    //         'message' => 'SMS sending failed',
    //         'error' => $e->getMessage()
    //     ], 500);
    // }


    $mode = env('OTP_MODE', 'fake');

if ($mode === 'twilio') {

    try {

        $twilio = new Client(
            env('TWILIO_SID'),
            env('TWILIO_AUTH_TOKEN')
        );

        $twilio->messages->create(
            $phone, 
            [
                "from" => env('TWILIO_PHONE'),
                "body" => "Your Chat App OTP is: $otp"
            ]
        );

    } catch (\Exception $e) {

        return response()->json([
            'success' => false,
            'message' => 'SMS sending failed',
            'error' => $e->getMessage()
        ], 500);
    }

}

    return response()->json([
        'success' => true,
        'message' => 'OTP sent successfully',
        'otp' => env('OTP_MODE') === 'fake' ? $otp : null   //for production 

    ]);
}


    /*
    |--------------------------------------------------------------------------
    | VERIFY OTP
    |--------------------------------------------------------------------------
    */

 public function verifyOtp(Request $request)
{
    try {

        $request->validate([
            'otp' => 'required|digits:6'
        ]);
$phone = $request->phone ?? session('auth_phone');

if (!$phone) {
    return response()->json([
        'success' => false,
        'message' => 'Phone number required.'
    ], 400);
}

        $otpRecord = OtpVerification::where('phone', $phone)->first();

        if (!$otpRecord) {
            return response()->json([
                'success' => false,
                'message' => 'OTP not found'
            ], 404);
        }

        if ($otpRecord->expires_at < now()) {
            return response()->json([
                'success' => false,
                'message' => 'OTP expired'
            ], 400);
        }

        if (!Hash::check($request->otp, $otpRecord->otp_hash)) {

            $otpRecord->increment('attempts');

            return response()->json([
                'success' => false,
                'message' => 'Invalid OTP'
            ], 400);
        }

        //Create user if not exists
        $user = User::firstOrCreate(

            ['phone' => $phone],

            [
                'name' => 'New User',
                'about' => null,
                'profile_photo' => null,
                'is_phone_verified' => true,
                'account_status' => 'active'
            ]

        );

        $user->update([
            'is_phone_verified' => true
        ]);

        $otpRecord->delete();
$token = $user->createToken('web_token')->plainTextToken;

if ($request->hasSession()) {
    $request->session()->regenerate();
    $request->session()->put('auth_user_id', $user->id);
    $request->session()->put('auth_token', $token);
}

        return response()->json([
            'success' => true,
            'redirect' => '/profile',
            'token' => $token
        ]);

    } catch (\Exception $e) {

        return response()->json([
            'success' => false,
            'message' => 'Server error',
            'error' => $e->getMessage()
        ], 500);
    }
}


public function showVerifyPhone()
{
    if (!session()->has('auth_phone')) {
        return redirect()->route('login');
    }

    return view('auth.verify');
}

}
