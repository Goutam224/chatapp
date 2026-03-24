<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\UserBlock;
use Illuminate\Support\Facades\Auth;
use App\Models\Chat;
use App\Models\Message;
use App\Models\ChatParticipant;
use Illuminate\Support\Facades\Log;
class BlockController extends Controller
{
    public function block(Request $request)
{
    $request->validate([
        'user_id' => 'required|exists:users,id'
    ]);
$authId = $this->getAuthId();
    $targetId = $request->user_id;

    if ($authId == $targetId) {
        return response()->json(['error' => 'Cannot block yourself'], 400);
    }

    UserBlock::firstOrCreate([
        'blocker_id' => $authId,
        'blocked_id' => $targetId
    ]);

    // ✅ FIND PRIVATE CHAT
    $chat = Chat::where('type', 'private')
        ->whereHas('participants', function($q) use ($authId){
            $q->where('user_id', $authId);
        })
        ->whereHas('participants', function($q) use ($targetId){
            $q->where('user_id', $targetId);
        })
        ->first();

    // ✅ INSERT SYSTEM MESSAGE
    if ($chat) {
        Message::create([
            'chat_id' => $chat->id,
            'sender_id' => $authId,
            'message' => 'You blocked this contact.',
            'visible_to' => [$authId], 
            'type' => 'system',
            'sent_at' => now()
        ]);
    }
try {
    broadcast(new \App\Events\UserBlocked((int)$authId, (int)$targetId, 'blocked'))->toOthers();
    Log::info('UserBlocked broadcast fired', ['blocker' => $authId, 'target' => $targetId]);
} catch (\Throwable $e) {
    Log::error('UserBlocked broadcast FAILED: ' . $e->getMessage());
}
return response()->json(['status' => 'blocked']);
}

    public function unblock(Request $request)
{
    $request->validate([
        'user_id' => 'required|exists:users,id'
    ]);

  $authId = $this->getAuthId();
    $targetId = $request->user_id;

    UserBlock::where('blocker_id', $authId)
        ->where('blocked_id', $targetId)
        ->delete();

    // ✅ FIND PRIVATE CHAT
    $chat = Chat::where('type', 'private')
        ->whereHas('participants', function($q) use ($authId){
            $q->where('user_id', $authId);
        })
        ->whereHas('participants', function($q) use ($targetId){
            $q->where('user_id', $targetId);
        })
        ->first();

    // ✅ INSERT SYSTEM MESSAGE
    if ($chat) {
        Message::create([
            'chat_id' => $chat->id,
            'sender_id' => $authId,
            'message' => 'You unblocked this contact.',
            'type' => 'system',
            'visible_to' => [$authId],
            'sent_at' => now()
        ]);
    }

  broadcast(new \App\Events\UserBlocked($authId, $targetId, 'unblocked'))->toOthers();
return response()->json(['status' => 'unblocked']);
}

    public function status($userId)
    {
        $auth = $this->getAuthUser();

        return response()->json([
            'blocked_by_me' => $auth->hasBlocked($userId),
            'blocked_me' => $auth->isBlockedBy($userId)
        ]);
    }
}