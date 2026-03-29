<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ChatParticipant;
use App\Helpers\AuthHelper;

class TypingController extends Controller
{
  public function typing(Request $request)
{
    $user = AuthHelper::user();

    if (!$user) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }

    $request->validate([
        'chat_id' => 'required|integer'
    ]);

    $isParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', $user->id)
        ->exists();

    if (!$isParticipant) {
        return response()->json([
            'error' => 'User is not a participant of this chat'
        ], 403);
    }

    // ✅ DEBUG — check if socket ID is received
    \Illuminate\Support\Facades\Log::info('Typing socket ID', [
        'socket_id' => $request->header('X-Socket-ID'),
        'user_id'   => $user->id,
        'chat_id'   => $request->chat_id
    ]);

    broadcast(new \App\Events\UserTyping(
        $request->chat_id,
        $user->id
    ))->toOthers();

    return response()->json([
        'ok' => true,
        'socket_id_received' => $request->header('X-Socket-ID') // ✅ show in response
    ]);
}
}