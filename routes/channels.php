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
    // ✅ use $user->id directly (Laravel passes authenticated user)
    return \App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists();
});

Broadcast::channel('chat.presence.{chatId}', function ($user, $chatId) {
    if(!\App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists()){
        return false;
    }

    $user->update(['last_seen' => now()]);

    return [
        'id'        => $user->id,
        'name'      => $user->name,
        'last_seen' => optional($user->last_seen)->format('g:i A'),
    ];
});

Broadcast::channel('user.{id}', function ($user, $id) {
    // ✅ use $user->id directly
    Log::info('user channel auth', ['user_id' => $user->id, 'id' => $id]);
    return (int) $user->id === (int) $id;
});

Broadcast::channel('global.presence', function ($user) {
    return [
        'id'      => $user->id,
        'name'    => $user->name,
        'blocked' => \App\Models\UserBlock::where(function($q) use ($user){
            $q->where('blocker_id', $user->id)
              ->orWhere('blocked_id', $user->id);
        })->exists()
    ];
});

Broadcast::channel('user.messages.{userId}', function ($user, $userId) {
    // ✅ use $user->id directly
    return (int) $user->id === (int) $userId;
});
