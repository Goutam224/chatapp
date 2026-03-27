<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use App\Helpers\AuthHelper;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ChatSearchController;
use App\Http\Controllers\PinChatController;
use App\Http\Controllers\PinMessageController;
use App\Http\Controllers\StarredMessageController;
use App\Http\Controllers\ClearChatController;
use App\Http\Controllers\DeleteChatController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\SharedMediaController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\TusController;
use App\Http\Controllers\DownloadSessionController;
use App\Http\Controllers\MediaDownloadController;
use App\Http\Controllers\MyProfileController;
use App\Http\Controllers\UserProfileController;

use App\Models\ChatParticipant;

/*
|==========================================================================
| CHAT ENGINE — EXTERNAL API ROUTES
|==========================================================================
|
| All routes here require:
|   Authorization: Bearer {token}
|
| Get your token first:
|   POST /auth/token
|   Body: { "api_key": "xxx", "external_id": "111", "name": "User", "email": "user@test.com" }
|   Response: { "token": "...", "user_id": 16 }
|
| Base URL: http://localhost:8000
|
|==========================================================================
*/


/*
|--------------------------------------------------------------------------
| STEP 0 — TOKEN EXCHANGE
| Get a Bearer token to use all other APIs
|--------------------------------------------------------------------------
|
| POST /auth/token
| Body: { "api_key": "xxx", "external_id": "111", "name": "User", "email": "user@test.com" }
| Response: { "token": "sanctum_token", "user_id": 16 }
|
*/
Route::post('/auth/token', [
    \App\Http\Controllers\TokenExchangeController::class,
    'exchange'
]);


/*
|--------------------------------------------------------------------------
| ALL ROUTES BELOW REQUIRE: Authorization: Bearer {token}
|--------------------------------------------------------------------------
*/
Route::middleware(['auth.session'])->group(function () {


    /*
    |--------------------------------------------------------------------------
    | STEP 1 — USERS
    | See who you can chat with
    |--------------------------------------------------------------------------
    |
    | GET /users
    | Headers: Authorization: Bearer {token}
    | Response: [{ "id": 1, "name": "John", "photo": "..." }, ...]
    |
    */
    Route::get('/users', [ChatController::class, 'users']);


    /*
    |--------------------------------------------------------------------------
    | STEP 2 — CREATE CHAT
    | Start a private chat with a user
    |--------------------------------------------------------------------------
    |
    | POST /chat/create
    | Headers: Authorization: Bearer {token}
    | Body: { "user_id": 5 }
    | Response: { "chat_id": 54, "created": true }
    |
    */
    Route::post('/chat/create', [ChatController::class, 'create']);


    /*
    |--------------------------------------------------------------------------
    | STEP 3 — SEND MESSAGE
    | Send a text message to a chat
    |--------------------------------------------------------------------------
    |
    | POST /message/send
    | Headers: Authorization: Bearer {token}
    | Body: { "chat_id": 54, "message": "Hello!" }
    | Optional: { "reply_id": 12 }  → to reply to a message
    | Response: { "id": 101, "message": "Hello!", "sent_at": "..." }
    |
    | Fires event → MessageSent on private-chat.54
    |
    */
    Route::post('/message/send', [ChatController::class, 'send']);


    /*
    |--------------------------------------------------------------------------
    | STEP 4 — OPEN CHAT (load messages)
    | Get messages for a chat
    |--------------------------------------------------------------------------
    |
    | GET /chat/{chat_id}
    | Headers: Authorization: Bearer {token}
    | Response: { "chat": {...}, "messages": [...], "participants": [...] }
    |
    */
    Route::get('/chat/{chat}', [ChatController::class, 'open']);


    /*
    |--------------------------------------------------------------------------
    | STEP 5 — CHATS LIST (sidebar)
    | Get all chats for the logged in user
    |--------------------------------------------------------------------------
    |
    | GET /chats
    | Headers: Authorization: Bearer {token}
    | Response: [{ "chat_id": 54, "last_message": "Hello!", "unread_count": 2, ... }]
    |
    */
    Route::get('/chats', [ChatController::class, 'list']);


    /*
    |--------------------------------------------------------------------------
    | STEP 6 — LOAD MORE MESSAGES (pagination)
    | Load older messages in a chat
    |--------------------------------------------------------------------------
    |
    | GET /chat/{chat_id}/more?before_id={message_id}
    | Headers: Authorization: Bearer {token}
    | Response: { "messages": [...], "has_more": true }
    |
    */
    Route::get('/chat/{chat}/more', [ChatController::class, 'loadMore']);


    /*
    |--------------------------------------------------------------------------
    | STEP 7 — MARK MESSAGE DELIVERED
    | Tell the sender their message was delivered to you
    |--------------------------------------------------------------------------
    |
    | POST /message/delivered/{message_id}
    | Headers: Authorization: Bearer {token}
    | Response: { "success": true }
    |
    | Fires event → MessageSent (with delivered_at updated) on private-chat.{id}
    |
    */
   Route::post('/message/delivered/{id}', [ChatController::class, 'markDelivered']);


    /*
    |--------------------------------------------------------------------------
    | STEP 8 — MARK MESSAGE SEEN
    | Tell the sender their message was read by you
    |--------------------------------------------------------------------------
    |
    | POST /message/seen/{message_id}
    | Headers: Authorization: Bearer {token}
    | Response: { "success": true }
    |
    | Fires event → MessageSent (with seen_at updated) on private-chat.{id}
    |
    */

       Route::post('/message/seen/{id}', [ChatController::class, 'markSeen']);




    /*
    |--------------------------------------------------------------------------
    | STEP 9 — MARK ALL DELIVERED
    | Mark all unread messages as delivered on app open
    |--------------------------------------------------------------------------
    |
    | POST /messages/mark-all-delivered
    | Headers: Authorization: Bearer {token}
    | Response: { "success": true }
    |
    */
    Route::post('/messages/mark-all-delivered', [ChatController::class, 'markAllDelivered']);


    /*
    |--------------------------------------------------------------------------
    | STEP 10 — TYPING INDICATOR
    | Broadcast that user is typing in a chat
    |--------------------------------------------------------------------------
    |
    | POST /typing
    | Headers: Authorization: Bearer {token}
    | Body: { "chat_id": 54 }
    | Response: { "ok": true }
    |
    | Fires event → UserTyping on private-chat.54
    |
    */


Route::post('/typing', function (Request $request) {

    $user = \App\Helpers\AuthHelper::user();

    if (!$user) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }

    $request->validate([
        'chat_id' => 'required|integer'
    ]);

    // Check if user belongs to this chat
    $isParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', $user->id)
        ->exists();

    if (!$isParticipant) {
        return response()->json([
            'error' => 'User is not a participant of this chat'
        ], 403);
    }

    event(new \App\Events\UserTyping(
        $request->chat_id,
        $user->id
    ));

    return response()->json([
        'ok' => true
    ]);
});

    Route::post('/typing', function (Request $request) {
        $user = AuthHelper::user();
        if (!$user) return response()->json([], 403);
        event(new \App\Events\UserTyping($request->chat_id, $user->id));
        return response()->json(['ok' => true]);
    });



    /*
    |--------------------------------------------------------------------------
    | MESSAGE MANAGEMENT
    |--------------------------------------------------------------------------
    |
    | Edit a message:
    |   POST /message/edit/{message_id}
    |   Body: { "message": "Updated text" }
    |   Fires event → MessageEdited on private-chat.{id}
    |
    | Delete for everyone:
    |   POST /message/delete/everyone/{message_id}
    |   Fires event → MessageDeleted on private-chat.{id}
    |
    | Delete for me only:
    |   POST /message/delete/me/{message_id}
    |
    | Message info (seen/delivered by whom):
    |   GET /message/info/{message_id}
    |
    */
    Route::post('/message/edit/{message}',            [\App\Http\Controllers\ChatController::class, 'edit']);
    Route::post('/message/delete/everyone/{id}',      [ChatController::class, 'deleteForEveryone']);
    Route::post('/message/delete/me/{id}',            [ChatController::class, 'deleteForMe']);
    Route::get('/message/info/{id}',                  [ChatController::class, 'info']);


    /*
    |--------------------------------------------------------------------------
    | CHAT SEARCH
    |--------------------------------------------------------------------------
    |
    | GET /chat/search?q=hello
    | Headers: Authorization: Bearer {token}
    | Response: { "chats": [...], "messages": [...] }
    |
    */
    Route::get('/chat/search', [ChatSearchController::class, 'search']);


    /*
    |--------------------------------------------------------------------------
    | LOAD AROUND MESSAGE (jump to message)
    |--------------------------------------------------------------------------
    |
    | GET /chat/load-around/{message_id}
    | Headers: Authorization: Bearer {token}
    |
    */
    Route::get('/chat/load-around/{messageId}', [ChatController::class, 'loadAroundMessage']);


    /*
    |--------------------------------------------------------------------------
    | PIN CHAT
    |--------------------------------------------------------------------------
    |
    | POST /chat/pin      Body: { "chat_id": 54 }
    | POST /chat/unpin    Body: { "chat_id": 54 }
    | GET  /chat/pinned
    |
    */
    Route::post('/chat/pin',    [PinChatController::class, 'pin']);
    Route::post('/chat/unpin',  [PinChatController::class, 'unpin']);
    Route::get('/chat/pinned',  [PinChatController::class, 'list']);


    /*
    |--------------------------------------------------------------------------
    | PIN MESSAGE
    |--------------------------------------------------------------------------
    |
    | POST /chat/pin-message    Body: { "message_id": 101 }
    | POST /chat/unpin-message  Body: { "message_id": 101 }
    |
    | Fires event → MessagePinned on private-chat.{id}
    |
    */
    Route::post('/chat/pin-message',   [PinMessageController::class, 'pin']);
    Route::post('/chat/unpin-message', [PinMessageController::class, 'unpin']);


    /*
    |--------------------------------------------------------------------------
    | STARRED MESSAGES
    |--------------------------------------------------------------------------
    |
    | POST /message/star          Body: { "message_id": 101 }
    | POST /message/unstar        Body: { "message_id": 101 }
    | GET  /starred-messages
    | POST /message/unstar-on-delete/{message_id}
    |
    */
    Route::post('/message/star',                          [StarredMessageController::class, 'star']);
    Route::post('/message/unstar',                        [StarredMessageController::class, 'unstar']);
    Route::get('/starred-messages',                       [StarredMessageController::class, 'list']);
    Route::post('/message/unstar-on-delete/{messageId}',  [StarredMessageController::class, 'unstarOnDelete']);


    /*
    |--------------------------------------------------------------------------
    | CLEAR & DELETE CHAT
    |--------------------------------------------------------------------------
    |
    | POST /chat/clear   Body: { "chat_id": 54 }  → clears messages for me only
    | POST /chat/delete  Body: { "chat_id": 54 }  → deletes chat for me only
    |
    */
    Route::post('/chat/clear',  [ClearChatController::class, 'clear']);
    Route::post('/chat/delete', [DeleteChatController::class, 'delete']);


    /*
    |--------------------------------------------------------------------------
    | BLOCK SYSTEM
    |--------------------------------------------------------------------------
    |
    | POST /block           Body: { "user_id": 5 }
    | POST /unblock         Body: { "user_id": 5 }
    | GET  /block/status/5
    |
    | Fires event → UserBlocked on private-user.{id}
    |
    */
    Route::post('/block',              [BlockController::class, 'block']);
    Route::post('/unblock',            [BlockController::class, 'unblock']);
    Route::get('/block/status/{user}', [BlockController::class, 'status']);


    /*
    |--------------------------------------------------------------------------
    | PRESENCE / LAST SEEN
    |--------------------------------------------------------------------------
    |
    | POST /user/update-last-seen   → call every 30s to keep last seen fresh
    | GET  /user/last-seen/{user_id}
    |
    */
    Route::post('/user/update-last-seen', function () {
        $user = AuthHelper::user();
        if ($user) {
            \App\Models\User::where('id', $user->id)->update(['last_seen' => now()]);
            return response()->json(['status' => true]);
        }
        return response()->json(['status' => false], 401);
    });

    Route::get('/user/last-seen/{id}', function ($id) {
        $authId = AuthHelper::id();
        if (!$authId) return response()->json(['last_seen' => null]);
        $user = \App\Models\User::find($id);
        if (!$user || !$user->last_seen) return response()->json(['last_seen' => null]);
        $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $user->id)
            ->where('blocked_id', $authId)->exists();
        if ($isBlockedBy) return response()->json(['last_seen' => null]);
        $lastSeen = \Carbon\Carbon::parse($user->last_seen);
        if ($lastSeen->isToday()) $formatted = 'today at ' . $lastSeen->format('g:i A');
        elseif ($lastSeen->isYesterday()) $formatted = 'yesterday at ' . $lastSeen->format('g:i A');
        else $formatted = $lastSeen->format('d/m/Y') . ' at ' . $lastSeen->format('g:i A');
        return response()->json(['last_seen' => $formatted]);
    });


    /*
    |--------------------------------------------------------------------------
    | PROFILE
    |--------------------------------------------------------------------------
    |
    | GET  /my/profile
    | POST /my/profile/update   Body: { "name": "John", "bio": "..." }
    | POST /my/profile/photo    Body: multipart/form-data  field: photo
    | GET  /user/profile/{user_id}
    |
    */
    Route::get('/my/profile',           [MyProfileController::class, 'get']);
    Route::post('/my/profile/update',   [MyProfileController::class, 'update']);
    Route::post('/my/profile/photo',    [MyProfileController::class, 'updatePhoto']);
    Route::get('/user/profile/{id}',    [UserProfileController::class, 'show']);


    /*
    |--------------------------------------------------------------------------
    | SHARED MEDIA
    |--------------------------------------------------------------------------
    |
    | GET /user/shared/{user_id}
    | Response: { "media": [...], "audio": [...], "docs": [...] }
    |
    */
    Route::get('/user/shared/{userId}', [SharedMediaController::class, 'index']);


    /*
    |--------------------------------------------------------------------------
    | MEDIA — SEND
    |--------------------------------------------------------------------------
    |
    | POST /media/send
    | Body: multipart/form-data
    |   chat_id: 54
    |   file: <binary>
    |
    | Response: { "message_id": 102, "media": {...} }
    | Fires event → MessageSent on private-chat.54
    |
    */
    Route::post('/media/send', [MediaController::class, 'send']);


    /*
    |--------------------------------------------------------------------------
    | MEDIA — DOWNLOAD / SERVE
    |--------------------------------------------------------------------------
    |
    | GET /media/{message_id}          → stream/download the file
    | GET /media/thumb/{message_id}    → get thumbnail (images/videos)
    |
    */
    Route::get('/media/{message}',       [MediaDownloadController::class, 'serve']);
    Route::get('/media/thumb/{message}', [MediaDownloadController::class, 'thumbnail']);


    /*
    |--------------------------------------------------------------------------
    | RESUMABLE UPLOAD (TUS protocol)
    |--------------------------------------------------------------------------
    |
    | POST   /upload/start              → start upload session
    | POST   /upload/chunk              → upload chunk
    | GET    /upload/status/{uuid}      → check upload progress
    | POST   /upload/finish             → finalize upload
    | POST   /upload/destroy/{uuid}     → cancel upload
    | POST   /upload/cancel/{uuid}      → cancel (alias)
    | GET    /upload/pending/{chat_id}  → get pending uploads for a chat
    | POST   /tus/complete              → TUS completion hook
    |
    */
    Route::post('/upload/start',           [UploadController::class, 'start']);
    Route::post('/upload/chunk',           [UploadController::class, 'chunk']);
    Route::get('/upload/status/{uuid}',    [UploadController::class, 'status']);
    Route::post('/upload/finish',          [UploadController::class, 'finish']);
    Route::post('/upload/destroy/{uuid}',  [UploadController::class, 'destroy']);
    Route::post('/upload/cancel/{uuid}',   [UploadController::class, 'cancel']);
    Route::get('/upload/pending/{chat}',   [UploadController::class, 'pending']);
    Route::post('/tus/complete',           [TusController::class, 'complete']);


    /*
    |--------------------------------------------------------------------------
    | DOWNLOAD SESSIONS
    |--------------------------------------------------------------------------
    |
    | POST /download/start
    | POST /download/progress
    | POST /download/complete
    | GET  /download/status/{message_id}
    | POST /download/status/batch
    |
    */
    Route::post('/download/start',          [DownloadSessionController::class, 'start']);
    Route::post('/download/progress',       [DownloadSessionController::class, 'progress']);
    Route::post('/download/complete',       [DownloadSessionController::class, 'complete']);
    Route::get('/download/status/{messageId}', [DownloadSessionController::class, 'status']);
    Route::post('/download/status/batch',   [DownloadSessionController::class, 'batchStatus']);

});


/*
|--------------------------------------------------------------------------
| TUS UPLOAD (public — TUS handles its own auth via upload token)
|--------------------------------------------------------------------------
*/
Route::any('/tus/upload',        [TusController::class, 'server']);
Route::any('/tus/upload/{token}', [TusController::class, 'server']);


/*
|==========================================================================
| WEBSOCKET EVENTS REFERENCE
|==========================================================================
|
| Connect to Reverb:
|   Host: localhost   Port: 8080   App Key: (REVERB_APP_KEY from .env)
|
| Subscribe to channels:
|   private-chat.{chat_id}       → messages, typing, edits, deletes, pins
|   private-user.{user_id}       → block/unblock events
|   private-user.messages.{id}   → new messages in deleted/cleared chats
|   presence-global.presence     → online/offline status
|
| Events you will receive:
|   .message.sent      → new message or delivery/seen update
|   .message.edited    → message text was changed
|   .message.deleted   → message deleted for everyone
|   .user.typing       → someone is typing  { userId, chatId }
|   .user.blocked      → block/unblock action { blockerId, blockedId, action }
|
|=========================================================================
*/
