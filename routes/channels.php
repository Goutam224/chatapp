<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return true;
});

Broadcast::channel('chat.{chatId}', function ($user, $chatId) {
    return true;
});

Broadcast::channel('dashboard.{chatId}', function ($user, $chatId) {

    return \App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', session('auth_user_id'))
        ->exists();

});

Broadcast::channel('chat.presence.{chatId}', function ($user, $chatId) {

    if(!\App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists()){
        return false;
    }

    // FIX: update last seen whenever presence authenticates
    $user->update([
        'last_seen' => now()
    ]);

    return [
        'id' => $user->id,
        'name' => $user->name,
        'last_seen' => optional($user->last_seen)->format('g:i A'),
    ];

});
Broadcast::channel('user.{id}', function ($user, $id) {
    $sessionId = session('auth_user_id');
    Log::info('user channel auth', ['session' => $sessionId, 'id' => $id]);
    return (int) $sessionId === (int) $id;
}); 
Broadcast::channel('global.presence', function ($user) {

    return [
        'id' => $user->id,
        'name' => $user->name,
        'blocked' => \App\Models\UserBlock::where(function($q) use ($user){
            $q->where('blocker_id', $user->id)
              ->orWhere('blocked_id', $user->id);
        })->exists()
    ];

});

Broadcast::channel('user.messages.{userId}', function ($user, $userId) {
    $sessionId = session('auth_user_id');
    return (int) $sessionId === (int) $userId;
});