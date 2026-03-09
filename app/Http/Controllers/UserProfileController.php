<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Chat;
use App\Models\Message;
use App\Models\ChatParticipant;
class UserProfileController extends Controller
{

public function show($id)
{
    $authId = session('auth_user_id');

    if (!$authId) {
        return response()->json([], 401);
    }

    $user = User::select(
        'id',
        'name',
        'phone',
        'about',
        'profile_photo',
        'last_seen'
    )->findOrFail($id);

    $isBlocking = \App\Models\UserBlock::where('blocker_id', $authId)
        ->where('blocked_id', $user->id)
        ->exists();

    $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $user->id)
        ->where('blocked_id', $authId)
        ->exists();

    // ===============================
    // ✅ ADD SHARED MEDIA COUNT
    // ===============================

    $sharedCount = 0;

    $chat = Chat::where('type', 'private')
        ->whereHas('participants', function($q) use ($authId) {
            $q->where('user_id', $authId);
        })
        ->whereHas('participants', function($q) use ($id) {
            $q->where('user_id', $id);
        })
        ->first();

    if ($chat) {
        $sharedCount = Message::where('chat_id', $chat->id)
    ->whereIn('type', ['image', 'video', 'audio', 'file'])
            ->where(function($q) use ($authId) {
                $q->whereNull('visible_to')
                  ->orWhereJsonContains('visible_to', $authId);
            })
            ->count();
    }

    // ===============================
    // BLOCK CASE
    // ===============================

    if ($isBlockedBy) {
        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'phone' => $user->phone,
            'about' => null,
            'profile_photo' => asset('/default.png'),
            'last_seen' => null,
            'shared_count' => $sharedCount 
        ]);
    }

    // ===============================
    // NORMAL RESPONSE
    // ===============================

    return response()->json([
        'id' => $user->id,
        'name' => $user->name,
        'phone' => $user->phone,
        'about' => $user->about,
        'profile_photo' =>
            $user->profile_photo
                ? asset($user->profile_photo)
                : asset('/default.png'),
        'last_seen' =>
            $user->last_seen
                ? date('g:i A', strtotime($user->last_seen))
                : 'recently',
        'shared_count' => $sharedCount
    ]);
}

}
