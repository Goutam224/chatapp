<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\StarredMessage;
use App\Models\Message;
use Illuminate\Validation\ValidationException;
class StarredMessageController extends Controller
{

public function star(Request $request)
{
    $authId = $this->getAuthId();

    // ✅ Authorization
    if (!$authId) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized.',
        ], 401);
    }

    $request->validate([
        'message_id' => ['required', 'integer', 'exists:messages,id'],
    ]);

    // ✅ Ensure message belongs to a chat the user is part of
    $message = Message::find($request->message_id);
    $isMember = $message->chat->participants()
        ->where('user_id', $authId)
        ->exists();

    if (!$isMember) {
        return response()->json([
            'success' => false,
            'message' => 'You are not authorized to star this message.',
        ], 403);
    }

    $alreadyExists = StarredMessage::where('user_id', $authId)
        ->where('message_id', $request->message_id)
        ->exists();

    if ($alreadyExists) {
        return response()->json([
            'success'         => false,
            'already_starred' => true,
            'message'         => 'Message is already starred.',
        ], 409);
    }

    StarredMessage::firstOrCreate([
        'user_id'    => $authId,
        'message_id' => $request->message_id,
    ]);

    return response()->json([
        'success'         => true,
        'already_starred' => false,
        'message'         => 'Message starred successfully.',
    ], 201);
}
public function unstar(Request $request)
{
    $authId = $this->getAuthId();

    // ✅ Authorization
    if (!$authId) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized.',
        ], 401);
    }

    // ✅ Validation with custom messages + your own JSON shape
    try {
        $request->validate([
            'message_id' => ['required', 'integer'],
        ]);
    } catch (ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => collect($e->errors())->flatten()->first(),
        ], 422);
    }

    // ✅ Check message exists first — separate from "not starred"
    $message = Message::find($request->message_id);
    if (!$message) {
        return response()->json([
            'success' => false,
            'message' => 'Message not found.',
        ], 404);
    }

    // ✅ Check user is a participant of the chat — separate 403
    $isMember = $message->chat->participants()
        ->where('user_id', $authId)
        ->exists();

    if (!$isMember) {
        return response()->json([
            'success' => false,
            'message' => 'You are not authorized to unstar this message.',
        ], 403);
    }

    $star = StarredMessage::where('user_id', $authId)
        ->where('message_id', $request->message_id)
        ->first();

    if (!$star) {
        return response()->json([
            'success' => false,
            'message' => 'Message is not starred.',
        ], 404);
    }

    // ✅ Ensure only the owner of the star can unstar it
    if ($star->user_id !== $authId) {
        return response()->json([
            'success' => false,
            'message' => 'You are not authorized to unstar this message.',
        ], 403);
    }

    $star->delete();

    return response()->json([
        'success' => true,
        'message' => 'Message unstarred successfully.',
    ], 200);
}

public function list()
{


    $authId = $this->getAuthId();

     if (!$authId) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized.',
        ], 401);
    }

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

   if(request()->ajax() || request()->wantsJson() || request()->bearerToken()){

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

           })->filter()->values(),
    'total'   => $stars->count(),
    'message' => $stars->count() === 0 ? 'No starred messages found.' : 'Starred messages retrieved successfully.',
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
    $authId = $this->getAuthId();

    // ✅ Authorization
    if (!$authId) {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized.',
        ], 401);
    }

    if (!is_numeric($messageId) || (int)$messageId <= 0) {
        return response()->json([
            'success' => false,
            'message' => 'Invalid message ID.',
        ], 422);
    }

    $message = \App\Models\Message::find($messageId);

if (!$message) {
    return response()->json([
        'success' => false,
        'message' => 'Message not found.',
    ], 404);
}

    // ✅ Ensure only the user's own starred entry is deleted
    $deleted = StarredMessage::where('user_id', $authId)
        ->where('message_id', $messageId)
        ->delete();

    return response()->json([
        'success' => true,
        'removed' => $deleted > 0,
        'message' => $deleted > 0
            ? 'Starred entry removed.'
            : 'No starred entry found for this message.',
    ], 200);
}
}
