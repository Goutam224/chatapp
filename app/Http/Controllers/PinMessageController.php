<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\PinnedMessage;
use Illuminate\Http\Request;

class PinMessageController extends Controller
{

public function pin(Request $request)
{

    $authId = $this->getAuthId();

   if (!$request->message_id || !\App\Models\Message::where('id', $request->message_id)->exists()) {
    return response()->json([
        'success' => false,
        'error'   => 'Message not found',
        'message_id' => $request->message_id
    ], 404);
}

    $message = Message::findOrFail($request->message_id);

    $participant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
    ->where('user_id', $authId)
    ->exists();

if (!$participant) {
    return response()->json([
        'success' => false,
        'error'   => 'Unauthorized',
        'message_id' => $message->id
    ], 403);
}

    $exists = PinnedMessage::where('message_id',$message->id)
        ->where('user_id',$authId)
        ->exists();
// ⭐ PIN LIMIT CHECK
$pinCount = PinnedMessage::where('chat_id',$message->chat_id)
    ->where('user_id',$authId)
    ->count();

if($pinCount >= 3){

    $oldest = PinnedMessage::where('chat_id',$message->chat_id)
        ->where('user_id',$authId)
        ->orderBy('pinned_at','asc')
        ->first();

    return response()->json([
        'success' => false,
        'limit' => true,
        'oldest_id' => $oldest->message_id
    ]);
}
   if($exists){
    return response()->json([
        'success'    => false,
        'error'      => 'Message already pinned',
        'message_id' => $message->id
    ], 409);
}

    PinnedMessage::create([
        'message_id'=>$message->id,
        'user_id'=>$authId,
        'chat_id'=>$message->chat_id,
        'pinned_at'=>now()
    ]);

    // ✅ CREATE SYSTEM MESSAGE (WhatsApp style history)
 Message::create([
    'chat_id'   => $message->chat_id,
    'sender_id' => $authId,
    'message'   => 'You pinned a message',
    'type'      => 'system',
    'visible_to'=> [$authId],
    'sent_at'   => now()
]);

   $pinned = PinnedMessage::where('message_id', $message->id)
    ->where('user_id', $authId)
    ->first();


return response()->json([
    'success'    => true,
    'message_id' => $message->id,
    'chat_id'    => $message->chat_id,
    'pinned_at'  => $pinned->pinned_at
]);

}

public function unpin(Request $request)
{

    $authId = $this->getAuthId();

    $request->validate([
        'message_id'=>'required'
    ]);

     // ✅ ADD THIS — check message exists first
    $message = \App\Models\Message::find($request->message_id);
    if (!$message) {
        return response()->json([
            'success'    => false,
            'error'      => 'Message not found',
            'message_id' => $request->message_id
        ], 404);
    }

    // ✅ ADD THIS — participant check
    $participant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
        ->where('user_id', $authId)
        ->exists();

    if (!$participant) {
        return response()->json([
            'success'    => false,
            'error'      => 'Unauthorized',
            'message_id' => $request->message_id
        ], 403);
    }

    $exists = PinnedMessage::where('message_id', $request->message_id)
        ->where('user_id', $authId)
        ->exists();

    if (!$exists) {
        return response()->json([
            'success' => false,
            'error'   => 'Message not pinned',
            'message_id' => $request->message_id
        ], 404);
    }


    PinnedMessage::where('message_id',$request->message_id)
        ->where('user_id',$authId)
        ->delete();

  return response()->json([
    'success'    => true,
    'message_id' => $request->message_id
]);
}

public function pinnedList($chatId)
{
    $authId = $this->getAuthId();

    // check participant
    $participant = \App\Models\ChatParticipant::where('chat_id', $chatId)
        ->where('user_id', $authId)
        ->exists();

    if (!$participant) {
        return response()->json([
            'success' => false,
            'error'   => 'Unauthorized'
        ], 403);
    }

    $pinned = PinnedMessage::where('chat_id', $chatId)
        ->where('user_id', $authId)
        ->orderBy('pinned_at', 'desc')
        ->with('message')
        ->get()
        ->map(function ($pin) {
            return [
                'message_id' => $pin->message_id,
                'chat_id'    => $pin->chat_id,
                'message'    => $pin->message?->message,
                'type'       => $pin->message?->type,
                'pinned_at'  => $pin->pinned_at,
                'pinned_by'  => $pin->user_id,
            ];
        });

    return response()->json([
        'success'         => true,
        'count'           => $pinned->count(),
        'pinned_messages' => $pinned
    ]);
}

}
