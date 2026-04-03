<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DeletedChat;
use Illuminate\Support\Facades\DB;

class DeleteChatController extends Controller
{

    public function delete(Request $request)
    {

        $authId = $this->getAuthId();

        $request->validate([
            'chat_id' => 'required|exists:chats,id'
        ]);

        // ✅ Authorization check — returns 403 if not a participant
        $isParticipant = DB::table('chat_participants')
            ->where('chat_id', $request->chat_id)
            ->where('user_id', $authId)
            ->exists();

        if (!$isParticipant) {
            return response()->json([
                'message' => 'Unauthorized. You are not a participant of this chat.'
            ], 403);
        }

        // ✅ Check if already deleted AND no new messages after deleted_at
        $deletedChat = DeletedChat::where('chat_id', $request->chat_id)
            ->where('user_id', $authId)
            ->first();

        if ($deletedChat) {
            $hasNewMessages = DB::table('messages')
                ->where('chat_id', $request->chat_id)
                ->where('created_at', '>', $deletedChat->deleted_at)
                ->exists();

            if (!$hasNewMessages) {
                return response()->json([
                    'message' => 'Chat has already been deleted.'
                ], 409);
            }
        }

        $now = now();

        // ✅ Mark chat as deleted
        DeletedChat::updateOrCreate(
            [
                'chat_id' => $request->chat_id,
                'user_id' => $authId
            ],
            [
                'deleted_at' => $now
            ]
        );

        // ✅ Also clear all messages up to this point
        \App\Models\ClearedChat::updateOrCreate(
            [
                'chat_id' => $request->chat_id,
                'user_id' => $authId
            ],
            [
                'cleared_at' => $now
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Chat deleted successfully.',
            'deleted_at' => $now->toDateTimeString()
        ]);

    }

}
