<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\ChatParticipant;
use App\Models\Chat;
use App\Models\Message;
use App\Models\UserBlock; // ✅ ADD THIS

class DashboardController extends Controller
{
public function index()
{
    $userId = session('auth_user_id');

    $user = User::find($userId);

    $chats = Chat::whereHas('participants', function($q) use ($userId) {
            $q->where('user_id', $userId);
        })
        ->with(['participants.user'])
        ->withMax(['messages as last_message_time' => function($q) use ($userId) {
            $q->where(function($query) use ($userId) {
                $query->whereNull('deleted_for_users')
                      ->orWhereRaw("JSON_CONTAINS(deleted_for_users, '\"$userId\"') = 0");
            });
        }], 'created_at')
 ->orderByDesc('last_message_time')
->get();

$pinnedChatIds = \App\Models\PinnedChat::where('user_id', $userId)
    ->orderBy('pinned_at', 'desc')
    ->pluck('chat_id')
    ->toArray();

$pinned = $chats->filter(fn($c) => in_array($c->id, $pinnedChatIds))
    ->sortBy(fn($c) => array_search($c->id, $pinnedChatIds))
    ->values();

$unpinned = $chats->filter(fn($c) => !in_array($c->id, $pinnedChatIds))
    ->values();

$chats = $pinned->concat($unpinned);


    // ✅ ADD THIS BLOCK (BLOCK FIX)

    $iBlockedUsers = UserBlock::where('blocker_id', $userId)
        ->pluck('blocked_id')
        ->toArray();

    $blockedByUsers = UserBlock::where('blocked_id', $userId)
        ->pluck('blocker_id')
        ->toArray();


    return view('dashboard.index', compact(
        'user',
        'chats',
        'iBlockedUsers',      // ✅ PASS
        'blockedByUsers',    // ✅ PASS
        'pinnedChatIds'
    ));
}
}