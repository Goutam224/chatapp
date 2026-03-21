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

   $count = PinnedChat::where('user_id',$userId)->count();

$alreadyPinned = PinnedChat::where('user_id',$userId)
    ->where('chat_id',$chatId)
    ->exists();

if(!$alreadyPinned && $count >= 3){

            return response()->json([
                'success'=>false,
                'message'=>'Maximum 3 chats can be pinned'
            ]);
        }

        PinnedChat::updateOrCreate(
            [
                'user_id'=>$userId,
                'chat_id'=>$chatId
            ],
            [
                'pinned_at'=>now()
            ]
        );

        return response()->json([
            'success'=>true
        ]);

    }

    public function unpin(Request $request)
    {

        $userId = $this->getAuthId();

        PinnedChat::where('user_id',$userId)
            ->where('chat_id',$request->chat_id)
            ->delete();

        return response()->json([
            'success'=>true
        ]);

    }

    public function list()
    {

        $userId = $this->getAuthId();

      $pinned = PinnedChat::where('user_id',$userId)
    ->orderBy('pinned_at', 'desc')
    ->pluck('chat_id');

        return response()->json($pinned);

    }

}