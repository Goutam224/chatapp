<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProfileController;
use App\Models\User;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ChatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response;
use App\Helpers\AuthHelper;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Broadcast;
use App\Events\UserTyping;
use App\Http\Controllers\UserProfileController;
use App\Http\Controllers\MyProfileController;
use App\Http\Controllers\TusController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\MediaDownloadController;
use App\Http\Controllers\DownloadSessionController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\SharedMediaController;
use App\Http\Controllers\PinMessageController;
use App\Http\Controllers\StarredMessageController;
use App\Http\Controllers\ClearChatController;
use App\Http\Controllers\ChatSearchController;
use App\Http\Controllers\PinChatController;
use App\Http\Controllers\DeleteChatController;
use App\Http\Controllers\TypingController;
use App\Models\ChatParticipant;
/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES (No authentication required)
|--------------------------------------------------------------------------
*/


Route::get('/my/profile', [MyProfileController::class, 'get']);

Route::post('/my/profile/update', [MyProfileController::class, 'update']);

Route::post('/my/profile/photo', [MyProfileController::class, 'updatePhoto']);


Route::get(
    '/user/profile/{id}',
    [UserProfileController::class, 'show']
);

Route::get('/', function () {

    // If already logged in, go to dashboard
    if (AuthHelper::check()) {
        return redirect()->route('dashboard');
    }

    return view('auth.login');

})->name('login');


Route::post('/send-otp', [AuthController::class, 'sendOtp']);


Route::get('/verifyphone', [AuthController::class, 'showVerifyPhone'])
    ->middleware('phone.entered')
    ->name('verifyphone');


Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);


/*
|--------------------------------------------------------------------------
| TOKEN EXCHANGE (External app integration)
|--------------------------------------------------------------------------
*/
Route::post('/auth/token', [
    \App\Http\Controllers\TokenExchangeController::class,
    'exchange'
]);

/*
|--------------------------------------------------------------------------
| AUTHENTICATED ROUTES (Token required)
|--------------------------------------------------------------------------
*/
Route::any('/tus/upload', [TusController::class, 'server']);
Route::any('/tus/upload/{token}', [TusController::class, 'server']);

Route::middleware(['auth.session'])->group(function () {

Route::post('/tus/complete', [TusController::class, 'complete']);
Route::post(
'/upload/start',
[UploadController::class,'start']
);

Route::post(
'/upload/chunk',
[UploadController::class,'chunk']
);

Route::get(
'/upload/status/{uuid}',
[UploadController::class,'status']
);

Route::post(
'/upload/finish',
[UploadController::class,'finish']
);

Route::middleware('auth')->get(
    '/upload/pending/{chat}',
    [UploadController::class, 'pending']
);

Route::post('/upload/destroy/{uuid}', [UploadController::class, 'destroy']);

Route::get('/media/{message}', [\App\Http\Controllers\MediaDownloadController::class, 'serve'])
    ->middleware('auth.session');

Route::get('/media/thumb/{message}', [MediaDownloadController::class, 'thumbnail'])
    ->middleware('auth.session');


    Route::post('/download/start', [DownloadSessionController::class, 'start']);
Route::post('/download/progress', [DownloadSessionController::class, 'progress']);
Route::post('/download/complete', [DownloadSessionController::class, 'complete']);
Route::get('/download/status/{messageId}', [DownloadSessionController::class, 'status']);
Route::post('/download/status/batch', [DownloadSessionController::class, 'batchStatus']);
    /*
    |--------------------------------------------------------------------------
    | PROFILE
    |--------------------------------------------------------------------------
    */

    Route::get('/profile', [ProfileController::class, 'create'])
        ->middleware('otp.verified')
        ->name('profile.setup');

    Route::post('/profile', [ProfileController::class, 'store'])
        ->middleware('otp.verified')
        ->name('profile.store');


    /*
    |--------------------------------------------------------------------------
    | DASHBOARD
    |--------------------------------------------------------------------------
    */

    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard');


    /*
    |--------------------------------------------------------------------------
    | CHAT SYSTEM
    |--------------------------------------------------------------------------
    */

    Route::get('/chats', [ChatController::class, 'list']); //done
Route::get('/chat/search', [ChatSearchController::class, 'search']);
  //does not run from backend side because message is stored in encrypted
    //form so this will be performed by frontend
Route::get('/chat/load-around/{messageId}', [ChatController::class,'loadAroundMessage']);



Route::post('/chat/pin',[PinChatController::class,'pin']); //done
Route::post('/chat/unpin',[PinChatController::class,'unpin']); //done
Route::get('/chat/pinned',[PinChatController::class,'list']); //done


    Route::get('/chat/{chat}', [ChatController::class, 'open']); //done

    Route::post('/message/send', [ChatController::class, 'send']);  //done

    Route::get('/users', [ChatController::class, 'users']);  //done

    Route::post('/chat/create', [ChatController::class, 'create']);    //done
Route::get('/chat/{chat}/more', [ChatController::class, 'loadMore']);  //done
Route::post('/typing', [TypingController::class, 'typing']);  //done

Route::post('/media/send', [App\Http\Controllers\MediaController::class, 'send']);

 Route::post('/block', [BlockController::class, 'block']);
    Route::post('/unblock', [BlockController::class, 'unblock']);
    Route::get('/block/status/{user}', [BlockController::class, 'status']);

    Route::get('/user/shared/{userId}', [SharedMediaController::class, 'index']);

    Route::get('/message/info/{id}', [ChatController::class,'info']);  //done


Route::post('/chat/pin-message',[PinMessageController::class,'pin']);

Route::post('/chat/unpin-message',[PinMessageController::class,'unpin']);

Route::post('/message/star',[StarredMessageController::class,'star']);
Route::post('/message/unstar',[StarredMessageController::class,'unstar']);

Route::get('/starred-messages',[StarredMessageController::class,'list']);


Route::post('/message/unstar-on-delete/{messageId}', [StarredMessageController::class, 'unstarOnDelete']);

Route::post('/chat/clear',[ClearChatController::class,'clear']);


Route::post('/chat/delete', [DeleteChatController::class,'delete']);

Route::post('/messages/mark-all-delivered', [ChatController::class, 'markAllDelivered']); //done

       Route::post('/message/seen/{id}', [ChatController::class, 'markSeen']); //done
Route::post('/message/edit/{message}', [App\Http\Controllers\ChatController::class, 'edit']);  //done
Route::post('/message/delete/everyone/{id}', [ChatController::class, 'deleteForEveryone']); //done

Route::post('/message/delivered/{id}', [ChatController::class, 'markDelivered']);  //done

Route::post('/message/delete/me/{id}', [ChatController::class, 'deleteForMe']); //done

});



Route::post('/broadcasting/auth/debug', function (Request $request) {
    $webUser = \Illuminate\Support\Facades\Auth::guard('web')->user();
    $sessionUserId = $request->session()->get('login_web_59ba36addc2b2f9401580f014c7f58ea4e30989d');

    return response()->json([
        'has_session'      => $request->hasSession(),
        'session_keys'     => $request->hasSession() ? array_keys($request->session()->all()) : [],
        'auth_token'       => $request->hasSession() ? $request->session()->get('auth_token') : null,
        'bearer'           => $request->bearerToken(),
        'web_guard_user'   => $webUser ? $webUser->id : null,
        'login_web_key'    => $sessionUserId,
        'channel_name'     => $request->input('channel_name'),
        'socket_id'        => $request->input('socket_id'),
    ]);
})->middleware(['web']);


Route::get('/reverblab', function () {
    return view('reverblab');
})->middleware(['web']);






Route::post('/user/update-last-seen', function () {
    $user = \App\Helpers\AuthHelper::user();
    if ($user) {
        \App\Models\User::where('id', $user->id)
            ->update(['last_seen' => now()]);

        // ✅ fire the event
        $user->refresh(); // get updated last_seen
        broadcast(new \App\Events\UserOnlineStatusUpdated($user));

        return response()->json(['status' => true]);
    }
    return response()->json(['status' => false], 401);
});

Route::get('/user/last-seen/{id}', function ($id) {

    $authId = \App\Helpers\AuthHelper::id();

    if (!$authId) {
        return response()->json(['last_seen' => null]);
    }

    $user = \App\Models\User::find($id);

    if(!$user || !$user->last_seen){
        return response()->json([
            'last_seen' => null
        ]);
    }

    // 🔒 CHECK IF THEY BLOCKED ME
    $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $user->id)
        ->where('blocked_id', $authId)
        ->exists();

    if ($isBlockedBy) {
        return response()->json([
            'last_seen' => null
        ]);
    }

    $lastSeen = \Carbon\Carbon::parse($user->last_seen);

    if ($lastSeen->isToday()) {
        $formatted = 'today at ' . $lastSeen->format('g:i A');
    } elseif ($lastSeen->isYesterday()) {
        $formatted = 'yesterday at ' . $lastSeen->format('g:i A');
    } else {
        $formatted = $lastSeen->format('d/m/Y') . ' at ' . $lastSeen->format('g:i A');
    }

    return response()->json([
        'last_seen' => $formatted
    ]);

});




/*
|--------------------------------------------------------------------------
| TEST AUTH ROUTE (for debugging)
|--------------------------------------------------------------------------
*/



Route::get('/test-auth', function () {

    if (!AuthHelper::check()) {
        return "NOT AUTHENTICATED";
    }

    $user = AuthHelper::user();

    return [
        'authenticated' => true,
        'user_id' => $user->id,
        'phone' => $user->phone,
        'name' => $user->name
    ];

});

Route::post(
'/upload/cancel/{uuid}',
[UploadController::class,'cancel']
);

