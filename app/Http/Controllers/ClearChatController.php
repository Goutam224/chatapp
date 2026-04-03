<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ClearedChat;
use Illuminate\Support\Facades\DB;

class ClearChatController extends Controller
{

    public function clear(Request $request)
    {

        $authId = $this->getAuthId();

        $request->validate([
            'chat_id' => 'required|exists:chats,id'
        ]);

        // ✅ Separate authorization check — returns proper 403 if not a participant
        $isParticipant = DB::table('chat_participants')
            ->where('chat_id', $request->chat_id)
            ->where('user_id', $authId)
            ->exists();

        if (!$isParticipant) {
            return response()->json([
                'message' => 'Unauthorized. You are not a participant of this chat.'
            ], 403);
        }

        // ✅ Check if already cleared AND no new messages after cleared_at
        $clearedChat = ClearedChat::where('chat_id', $request->chat_id)
            ->where('user_id', $authId)
            ->first();

        if ($clearedChat) {
            $hasNewMessages = DB::table('messages')
                ->where('chat_id', $request->chat_id)
                ->where('created_at', '>', $clearedChat->cleared_at)
                ->exists();

            if (!$hasNewMessages) {
                return response()->json([
                    'message' => 'Chat has already been cleared.'
                ], 409);
            }
        }

        ClearedChat::updateOrCreate(

            [
                'chat_id' => $request->chat_id,
                'user_id' => $authId
            ],

            [
                'cleared_at' => now()
            ]

        );

        return response()->json([
            'success' => true,
            'message' => 'Chat cleared successfully.',
            'cleared_at' => now()->toDateTimeString()
        ]);

    }

}
