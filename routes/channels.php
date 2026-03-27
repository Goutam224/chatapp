<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

// Default Laravel user channel
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return true;
});

// ✅ FIXED — added participant check instead of return true
// Laravel strips 'private-' prefix before matching, so 'private-chat.58' matches 'chat.{chatId}'
Broadcast::channel('chat.{chatId}', function ($user, $chatId) {
    return \App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists();
});

// Dashboard channel — unchanged
Broadcast::channel('dashboard.{chatId}', function ($user, $chatId) {
    return \App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists();
});

// Presence channel for chat — unchanged
Broadcast::channel('chat.presence.{chatId}', function ($user, $chatId) {
    if (!\App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $user->id)
        ->exists()) {
        return false;
    }

    $user->update(['last_seen' => now()]);

    return [
        'id'        => $user->id,
        'name'      => $user->name,
        'last_seen' => optional($user->last_seen)->format('g:i A'),
    ];
});

// Private user channel — unchanged
Broadcast::channel('user.{id}', function ($user, $id) {
    Log::info('user channel auth', ['user_id' => $user->id, 'id' => $id]);
    return (int) $user->id === (int) $id;
});

// Global presence channel — unchanged
Broadcast::channel('global.presence', function ($user) {
    return [
        'id'      => $user->id,
        'name'    => $user->name,
        'blocked' => \App\Models\UserBlock::where(function ($q) use ($user) {
            $q->where('blocker_id', $user->id)
              ->orWhere('blocked_id', $user->id);
        })->exists()
    ];
});

// Private user messages channel — unchanged
Broadcast::channel('user.messages.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
