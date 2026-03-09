<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\StarredMessage;
use App\Models\Message;

class StarredMessageController extends Controller
{

public function star(Request $request)
{
    $authId = session('auth_user_id');

    StarredMessage::firstOrCreate([
        'user_id' => $authId,
        'message_id' => $request->message_id
    ]);

    return response()->json([
        'success'=>true
    ]);
}

public function unstar(Request $request)
{
    $authId = session('auth_user_id');

    StarredMessage::where('user_id',$authId)
        ->where('message_id',$request->message_id)
        ->delete();

    return response()->json([
        'success'=>true
    ]);
}

public function list()
{
    $authId = session('auth_user_id');

   $stars = \App\Models\StarredMessage::where('user_id', $authId)
    ->with(['message.sender', 'message.media'])
    ->latest()
    ->get()
    ->filter(function($star) {
        // ✅ hide if message missing or deleted for everyone
        if(!$star->message) return false;
        if($star->message->deleted_for_everyone) return false;
        return true;
    });

    if(request()->ajax() || request()->wantsJson()){

        // ✅ fetch all download sessions for this user in one query (avoid N+1)
        $messageIds = $stars->pluck('message.id')->filter()->values()->toArray();

        $downloadedIds = \App\Models\DownloadSession::where('user_id', $authId)
            ->whereIn('message_id', $messageIds)
            ->where('completed', 1)
            ->pluck('message_id')
            ->toArray();

        return response()->json([
            'stars' => $stars->map(function($star) use ($authId, $downloadedIds) {

            if(!$star->message) return null;
if($star->message->deleted_for_everyone) return null;

                $isMine     = $star->message->sender_id == $authId;
                $downloaded = $isMine || in_array($star->message->id, $downloadedIds) ? 1 : 0;

                return [
                    'id'      => $star->id,
                    'message' => [
                        'id'                   => $star->message->id,
                        'chat_id'              => $star->message->chat_id,
                        'message'              => $star->message->message,
                        'deleted_for_everyone' => $star->message->deleted_for_everyone,
                        'created_at'           => $star->message->created_at,
                        'sender_id'            => $star->message->sender_id,
                        'sender_name'          => $star->message->sender->name ?? 'Unknown',
                        'chat_name'            => $star->message->sender->name ?? 'Unknown',
                        'downloaded'           => $downloaded, // ✅ real value now
                        'type'                 => $star->message->type,
                        'media'                => $star->message->media ? [
                            'file_type'       => $star->message->media->file_type,
                            'file_name'       => $star->message->media->file_name,
                            'file_size'       => $star->message->media->file_size,
                            'file_path'       => $star->message->media->file_path,
                            'thumbnail_path'  => $star->message->media->thumbnail_path,
                        ] : null,
                    ],
                ];

            })->filter()->values()
        ]);
    }

    // Fallback: full page load
    $chats = \App\Models\Chat::with(['participants.user', 'messages' => function($q){
            $q->orderBy('created_at', 'desc');
        }])
        ->whereHas('participants', function($q) use ($authId){
            $q->where('user_id', $authId);
        })
        ->get()
        ->sortByDesc(function($chat){
            $first = $chat->messages->first();
            return $first ? $first->created_at : null;
        });

    $user = \App\Models\User::find($authId);

    return view('contextmenu.starred_message', [
        'stars' => $stars,
        'chats' => $chats,
        'user'  => $user,
        'page'  => 'starred'
    ]);
}
public function unstarOnDelete($messageId)
{
    $authId = session('auth_user_id');

    StarredMessage::where('user_id', $authId)
        ->where('message_id', $messageId)
        ->delete();

    return response()->json(['success' => true]);
}

}