<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserBlock;
use Illuminate\Support\Facades\Auth;
use App\Models\Chat;
use App\Models\Message;
use App\Models\ChatParticipant;
use Illuminate\Support\Facades\Log;
use App\Models\User;
class BlockController extends Controller
{
    public function block(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $authId   = $this->getAuthId();
        $targetId = $request->user_id;

        if ($authId == $targetId) {
            return response()->json(['error' => 'Cannot block yourself'], 400);
        }

        // ✅ Check if already blocked
        $alreadyBlocked = UserBlock::where('blocker_id', $authId)
            ->where('blocked_id', $targetId)
            ->exists();

        if ($alreadyBlocked) {
            return response()->json([
                'message' => 'User is already blocked.'
            ], 409);
        }

        UserBlock::firstOrCreate([
            'blocker_id' => $authId,
            'blocked_id' => $targetId
        ]);

        // ✅ Find private chat
        $chat = Chat::where('type', 'private')
            ->whereHas('participants', function($q) use ($authId) {
                $q->where('user_id', $authId);
            })
            ->whereHas('participants', function($q) use ($targetId) {
                $q->where('user_id', $targetId);
            })
            ->first();

        // ✅ Insert system message
        if ($chat) {
            Message::create([
                'chat_id'    => $chat->id,
                'sender_id'  => $authId,
                'message'    => 'You blocked this contact.',
                'visible_to' => [$authId],
                'type'       => 'system',
                'sent_at'    => now()
            ]);
        }

        // ✅ Fix — removed toOthers() so event fires for ALL including sender
        try {
            broadcast(new \App\Events\UserBlocked(
                (int) $authId,
                (int) $targetId,
                'blocked'
            ));
            Log::info('UserBlocked broadcast fired', [
                'blocker' => $authId,
                'target'  => $targetId
            ]);
        } catch (\Throwable $e) {
            Log::error('UserBlocked broadcast FAILED: ' . $e->getMessage());
        }

        return response()->json([
            'status'  => 'blocked',
            'message' => 'User blocked successfully.'
        ]);
    }

    public function unblock(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $authId   = $this->getAuthId();
        $targetId = $request->user_id;

        // ✅ Check if not blocked at all
        $isBlocked = UserBlock::where('blocker_id', $authId)
            ->where('blocked_id', $targetId)
            ->exists();

        if (!$isBlocked) {
            return response()->json([
                'message' => 'User is not blocked.'
            ], 409);
        }

        UserBlock::where('blocker_id', $authId)
            ->where('blocked_id', $targetId)
            ->delete();

        // ✅ Find private chat
        $chat = Chat::where('type', 'private')
            ->whereHas('participants', function($q) use ($authId) {
                $q->where('user_id', $authId);
            })
            ->whereHas('participants', function($q) use ($targetId) {
                $q->where('user_id', $targetId);
            })
            ->first();

        // ✅ Insert system message
        if ($chat) {
            Message::create([
                'chat_id'    => $chat->id,
                'sender_id'  => $authId,
                'message'    => 'You unblocked this contact.',
                'type'       => 'system',
                'visible_to' => [$authId],
                'sent_at'    => now()
            ]);
        }

        // ✅ Fix — removed toOthers() so event fires for ALL
        broadcast(new \App\Events\UserBlocked(
            $authId,
            $targetId,
            'unblocked'
        ));

        return response()->json([
            'status'  => 'unblocked',
            'message' => 'User unblocked successfully.'
        ]);
    }

   public function status($userId)
{
    $auth = $this->getAuthUser();

    // ✅ Validate user exists
    if (!User::where('id', $userId)->exists()) {
        return response()->json([
            'error' => 'User not found'
        ], 422);
    }

    return response()->json([
        'user_id'       => (int) $userId,
        'blocked_by_me' => (bool) $auth->hasBlocked($userId),
        'blocked_me'    => (bool) $auth->isBlockedBy($userId)
    ]);
}
}
