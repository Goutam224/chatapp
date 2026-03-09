<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\PinnedMessage;
use Illuminate\Http\Request;

class PinMessageController extends Controller
{

public function pin(Request $request)
{

    $authId = session('auth_user_id');

    $request->validate([
        'message_id' => 'required|exists:messages,id'
    ]);

    $message = Message::findOrFail($request->message_id);

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
            'success'=>false
        ]);
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
    'type'      => 'text',
    'visible_to'=> [$authId], 
    'sent_at'   => now()
]);

    return response()->json([
        'success'=>true,
        'message_id'=>$message->id
    ]);
}

public function unpin(Request $request)
{

    $authId = session('auth_user_id');

    $request->validate([
        'message_id'=>'required'
    ]);

    PinnedMessage::where('message_id',$request->message_id)
        ->where('user_id',$authId)
        ->delete();

    return response()->json([
        'success'=>true
    ]);

}

}
