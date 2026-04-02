<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PinnedChat;

class PinChatController extends Controller
{

    public function pin(Request $request)
    {

        $userId = $this->getAuthId();

        $chatId = $request->chat_id;

        $chatExists = \App\Models\Chat::where('id', $chatId)->exists();
if (!$chatExists) {
    return response()->json([
        'success' => false,
        'error'   => 'Chat not found',
        'chat_id' => $chatId
    ], 404);
}

   $count = PinnedChat::where('user_id',$userId)->count();

$alreadyPinned = PinnedChat::where('user_id',$userId)
    ->where('chat_id',$chatId)
    ->exists();

 if ($alreadyPinned) {
            return response()->json([
                'success' => false,
                'error'   => 'Chat already pinned',
                'chat_id' => $chatId
            ], 409);
        }

if(!$alreadyPinned && $count >= 3){

            return response()->json([
                'success'=>false,
                'error'=>'Maximum 3 chats can be pinned'
            ],422);
        }

      $pinned=PinnedChat::updateOrCreate(
            [
                'user_id'=>$userId,
                'chat_id'=>$chatId
            ],
            [
                'pinned_at'=>now()
            ]
        );

        return response()->json([
            'success'   => true,
            'chat_id'   => $chatId,
            'pinned_at' => $pinned->pinned_at
        ]);

    }

    public function unpin(Request $request)
    {

        $userId = $this->getAuthId();
 $chatId = $request->chat_id;
         $exists = PinnedChat::where('user_id', $userId)
            ->where('chat_id', $chatId)
            ->exists();


             if (!$exists) {
        return response()->json([
            'success' => false,
            'error'   => 'Chat not pinned',
            'chat_id' => $chatId
        ], 404);
    }

        PinnedChat::where('user_id',$userId)
            ->where('chat_id',$request->chat_id)
            ->delete();

        return response()->json([
            'success' => true,
            'chat_id' => $chatId
        ]);


    }

    public function list()
    {

        $userId = $this->getAuthId();

      $pinned = PinnedChat::where('user_id',$userId)
    ->orderBy('pinned_at', 'desc')
    ->pluck('chat_id');

       return response()->json([
        'success'      => true,
        'count'        => $pinned->count(),
        'pinned_chats' => $pinned
    ]);
    }

}
