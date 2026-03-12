<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use App\Models\Message;
use App\Models\User;
use App\Models\ChatParticipant;
use Illuminate\Support\Facades\Auth;
use App\Events\MessageSent;
use Illuminate\Support\Facades\URL;
use App\Models\DownloadSession;
use App\Models\PinnedMessage;
use Illuminate\Support\Facades\DB;
class ChatController extends Controller
{
public function users()
{
    $authId = session('auth_user_id');

    if (!$authId) {
        return response()->json([], 401);
    }

    $users = User::where('id','!=',$authId)->get();

    foreach($users as $user){

$isBlockedBy = \App\Models\UserBlock::where('blocker_id', $user->id)
    ->where('blocked_id', $authId)
    ->exists();

if ($isBlockedBy) {

    $user->profile_photo = null;
    $user->about = null;
    $user->last_seen = null;

    $user->last_message = null;
    $user->unread_count = 0;

    continue; // skip normal chat preview logic
}
        $chat = Chat::whereHas('participants', function($q) use ($authId){
                $q->where('user_id',$authId);
            })
            ->whereHas('participants', function($q) use ($user){
                $q->where('user_id',$user->id);
            })
            ->first();

        if($chat){

            // unread count
            $user->unread_count = Message::where('chat_id',$chat->id)
                ->where('sender_id','!=',$authId)
                ->whereNull('seen_at')
                ->count();

$clear = \App\Models\ClearedChat::where('chat_id',$chat->id)
    ->where('user_id',$authId)
    ->value('cleared_at');

$lastQuery = Message::where('chat_id', $chat->id);

if($clear){
    $lastQuery->where('created_at','>',$clear);
}

$last = $lastQuery
    ->where(function($q) use ($authId){

        // hide delete for me messages
        $q->whereNull('deleted_for_users')
          ->orWhereJsonDoesntContain('deleted_for_users', $authId);

    })
    ->orderBy('created_at', 'desc')
    ->first();

if($last){
    if($last->deleted_for_everyone == 1){
        $user->last_message = 'This message was deleted';
    } else {
        // ✅ If block exists and message was edited after block → show original
        $blockTime = null;
        $block = \App\Models\UserBlock::where(function($q) use ($authId, $user){
            $q->where(function($q2) use ($authId, $user){
                $q2->where('blocker_id', $authId)
                   ->where('blocked_id', $user->id);
            })->orWhere(function($q2) use ($authId, $user){
                $q2->where('blocker_id', $user->id)
                   ->where('blocked_id', $authId);
            });
        })->orderBy('created_at','asc')->first();
        $blockTime = $block?->created_at;

        if(
            $blockTime &&
            $last->edited_at &&
            $last->sender_id != $authId &&
            $last->edited_at > $blockTime &&
            !is_null($last->original_message)
        ){
            $user->last_message = $last->original_message;
        } else {
            $user->last_message = $last->message;
        }
    }
}else{

    $user->last_message = null;

}

        } else {

            $user->unread_count = 0;
            $user->last_message = null;

        }
    }

    return response()->json($users);
}




    public function create(Request $request)
    {
    

        // Try both auth methods
       $authId = session('auth_user_id');


        if (!$authId) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized - Session or auth missing'
            ], 401);
        }

        $otherId = $request->input('user_id');


        if (!$otherId) {
            return response()->json([
                'success' => false,
                'error' => 'User id missing'
            ], 400);
        }

        // Check if other user exists
        $otherUser = User::find($otherId);
        if (!$otherUser) {
            return response()->json([
                'success' => false,
                'error' => 'User not found'
            ], 404);
        }

        // Find existing chat safely
       // Find existing chat
$chat = Chat::where('type', 'private')
    ->whereHas('participants', function($q) use ($authId) {
        $q->where('user_id', $authId);
    })
    ->whereHas('participants', function($q) use ($otherId) {
        $q->where('user_id', $otherId);
    })
    ->has('participants', '=', 2)
    ->first();

        if (!$chat) {
            $chat = Chat::create([
                'type' => 'private',
                'created_by' => $authId
            ]);

            ChatParticipant::create([
                'chat_id' => $chat->id,
                'user_id' => $authId
            ]);

            ChatParticipant::create([
                'chat_id' => $chat->id,
                'user_id' => $otherId
            ]);
        }

        return response()->json([
            'success' => true,
            'id' => $chat->id
        ]);
    }

    public function open(Chat $chat)
    {
       $authId = session('auth_user_id');
        
        // Verify user is participant
        $isParticipant = ChatParticipant::where('chat_id', $chat->id)
        
            ->where('user_id', $authId)
            ->exists();
            
        if (!$isParticipant) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized'
            ], 403);
        }

// Check if other user blocked me
$otherParticipant = ChatParticipant::where('chat_id', $chat->id)
    ->where('user_id', '!=', $authId)
    ->first();

    
$theyBlockedMe = false;

if ($otherParticipant) {
    $theyBlockedMe = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)
        ->where('blocked_id', $authId)
        ->exists();
}
$iBlocked = false;

if ($otherParticipant) {
    $iBlocked = \App\Models\UserBlock::where('blocker_id', $authId)
        ->where('blocked_id', $otherParticipant->user_id)
        ->exists();
}
// ONLY mark delivered & seen if they did NOT block me
if (!$theyBlockedMe && request()->has('mark_seen')) {

 // DELIVERED — skip messages sent while block was active (visible_to restricted)
$undelivered = Message::where('chat_id', $chat->id)
    ->where('sender_id', '!=', $authId)
    ->whereNull('delivered_at')
    ->where(function($q) use ($authId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', $authId);
    })
    ->get();

    foreach ($undelivered as $msg) {
        $msg->delivered_at = now();
        $msg->save();
        broadcast(new \App\Events\MessageSent($msg))->toOthers();
    }
// SEEN — skip messages sent while block was active (visible_to restricted)
$unseen = Message::where('chat_id', $chat->id)
    ->where('sender_id', '!=', $authId)
    ->whereNull('seen_at')
    ->where(function($q) use ($authId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', $authId);
    })
    ->get();

    if ($unseen->isNotEmpty()) {

        $seenIds = [];
        $seenAt = now();

        foreach ($unseen as $msg) {
            $msg->seen_at = $seenAt;
            $msg->save();
            $seenIds[] = $msg->id;
        }
$latestMessage = Message::where('chat_id', $chat->id)
    ->orderBy('created_at', 'desc')
    ->first();

if ($latestMessage) {
    broadcast(new \App\Events\MessageSent($latestMessage, $seenIds))->toOthers();
}
    }
}

// ✅ Get deleted_at BEFORE removing the record
$deletedAt = \App\Models\DeletedChat::where('chat_id', $chat->id)
    ->where('user_id', $authId)
    ->value('deleted_at');

// ✅ Now remove it so chat stays visible after this open
\App\Models\DeletedChat::where('chat_id', $chat->id)
    ->where('user_id', $authId)
    ->delete();

$clear = \App\Models\ClearedChat::where('chat_id',$chat->id)
    ->where('user_id',$authId)
    ->value('cleared_at');

 $query = Message::where('chat_id',$chat->id);

if($clear){
    $query->where('created_at','>', $clear);
}

// ✅ Only show messages sent AFTER the chat was deleted
if($deletedAt){
    $query->where('created_at','>', $deletedAt);
}
$messages = $query

    // ✅ Only show messages visible to me
    ->where(function($q) use ($authId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', $authId);
    })

    // keep your delete-for-me logic
    ->where(function($q) use ($authId){
        $q->whereNull('deleted_for_users')
          ->orWhereJsonDoesntContain('deleted_for_users', $authId);
    })

->with(['sender','media','reply.sender','reply.media','linkPreview'])
    ->orderBy('created_at', 'asc')
    ->get();
$downloadedIds = DownloadSession::where('user_id', $authId)
    ->whereIn('message_id', $messages->pluck('id'))
    ->where('completed', 1)
    ->pluck('message_id')
    ->toArray();

foreach ($messages as $message) {

    // ✅ If I am sender → always mark downloaded
    if ($message->sender_id == $authId) {
        $message->downloaded = 1;
        continue;
    }

    // ✅ If media exists → check session
    if ($message->media) {
        $message->downloaded = in_array($message->id, $downloadedIds) ? 1 : 0;
    } else {
        $message->downloaded = 1;
    }
}

$authId = session('auth_user_id');

$pinnedQuery = PinnedMessage::where('chat_id', $chat->id)
    ->where('user_id', $authId)
    ->with('message.media');

if ($clear) {
    $pinnedQuery->whereHas('message', function ($q) use ($clear) {
        $q->where('created_at', '>', $clear);
    });
}

$pinned = $pinnedQuery
    ->orderBy('pinned_at')
    ->get()
    ->map(function($p){

        if(!$p->message){
            return null;
        }

        $msg = $p->message;

        return [
            'id'        => $msg->id,
            'message'   => $msg->message,
            'type'      => $msg->type,
            'media'     => $msg->media,
            'pinned_at' => $p->pinned_at
        ];
    })
    ->filter()
    ->values();

 $pinnedIds = $pinned->pluck('id')->toArray();
 $starredIds = \App\Models\StarredMessage::where('user_id', $authId)
    ->pluck('message_id')
    ->toArray();
// AFTER
    $blockTime = null;

if($otherParticipant){
    $block = \App\Models\UserBlock::where(function($q) use ($authId, $otherParticipant){
        $q->where(function($q2) use ($authId, $otherParticipant){
            $q2->where('blocker_id', $authId)
               ->where('blocked_id', $otherParticipant->user_id);
        })->orWhere(function($q2) use ($authId, $otherParticipant){
            $q2->where('blocker_id', $otherParticipant->user_id)
               ->where('blocked_id', $authId);
        });
    })->orderBy('created_at','asc')->first();
    $blockTime = $block?->created_at;
}
$messages = $messages->map(function ($msg) use ($pinnedIds, $starredIds, $authId, $blockTime) {
    $arr['link_preview'] = $msg->linkPreview;
    $arr = $msg->toArray();

$arr['is_pinned'] = in_array($msg->id, $pinnedIds);
$arr['is_starred'] = in_array($msg->id, $starredIds);
    // ✅ who sent this message (Goutam's name on his messages)
    $arr['sender_name'] = $msg->sender->name ?? 'User';
// ✅ If block exists and message was edited after block → show original
if(
    $blockTime &&
    $msg->edited_at &&
    $msg->sender_id != $authId &&
    $msg->edited_at > $blockTime &&
    !is_null($msg->original_message)
){
    $arr['message'] = $msg->original_message;
    $arr['edited_at'] = null;
}

    if ($msg->reply) {
        $arr['reply'] = [
            'id'          => $msg->reply->id,
            'message'     => $msg->reply->message,
            'sender_name' => $msg->reply->sender->name ?? 'User',
            'type'        => $msg->reply->type,
            'media'       => $msg->reply->media,
        ];
    }

    return $arr;
});

   
return response()->json([
    'success'         => true,
    'messages'        => $messages,
    'pinned_messages' => $pinned,
    'they_blocked_me' => $theyBlockedMe,
    'i_blocked'       => $iBlocked
]);
    }

public function send(Request $request)
{
    $authId = session('auth_user_id');

    $request->validate([
        'chat_id' => 'required|exists:chats,id',
        'message' => 'required|string|max:5000',
        'reply_to' => 'nullable|exists:messages,id'
    ]);

    // ✅ FIRST: Verify participant
    $isParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', $authId)
        ->exists();

    if (!$isParticipant) {
        return response()->json([
            'success' => false,
            'error' => 'Unauthorized'
        ], 403);
    }

    // ✅ THEN: Block check
    $otherParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', '!=', $authId)
        ->first();

    if ($otherParticipant) {

        $isBlocking = \App\Models\UserBlock::where('blocker_id', $authId)
            ->where('blocked_id', $otherParticipant->user_id)
            ->exists();

        $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)
            ->where('blocked_id', $authId)
            ->exists();

      // ✅ If THEY blocked ME → save silently, visible only to sender, no broadcast
if ($isBlockedBy) {
    $message = Message::create([
        'chat_id'    => $request->chat_id,
        'sender_id'  => $authId,
        'message'    => $request->message,
        'sent_at'    => now(),
        'visible_to' => [$authId],
    ]);

    return response()->json([
        'success' => true,
        'message' => $message->load('sender')
    ]);
}
// ✅ If I blocked THEM → save but restrict visibility to only me, DO NOT broadcast
if ($isBlocking) {
    $message = Message::create([
        'chat_id'    => $request->chat_id,
        'sender_id'  => $authId,
        'message'    => $request->message,
        'sent_at'    => now(),
        'visible_to' => [$authId],  // ← Only sender sees this
    ]);

    return response()->json([
        'success' => true,
        'message' => $message->load('sender')
    ]);
}
    }
// ✅ Restore chat for other user if they had deleted it
\App\Models\DeletedChat::where('chat_id', $request->chat_id)
    ->where('user_id', '!=', $authId)
    ->delete();

// ✅ NORMAL FLOW (only if no blocking at all)
  $type = 'text';

if (preg_match('/https?:\/\/\S+/i', $request->message)) {
    $type = 'link';
}

$message = Message::create([
    'chat_id' => $request->chat_id,
    'sender_id' => $authId,
    'message' => $request->message,
    'reply_to' => $request->reply_to,
    'type' => $type,
    'sent_at' => now()
]);

\App\Services\LinkPreviewService::generate($message);

// reload message WITH preview
$message = Message::with('sender','linkPreview')->find($message->id);
    // broadcast only for normal messages
broadcast(new \App\Events\MessageSent($message->load('linkPreview')))->toOthers();

    return response()->json([
        'success' => true,
        'message' => $message->load('sender','linkPreview')
    ]);
}

public function edit(Request $request, Message $message)
{
    if($message->sender_id != session('auth_user_id')){
        return response()->json(['error'=>'Unauthorized'], 403);
    }
    // ADD this one line:
if(is_null($message->original_message)){
    $message->original_message = $message->message;
}

    $message->message = $request->message;
    $message->edited_at = now();
    $message->save();

    $message = Message::find($message->id);

    // ✅ Only broadcast if no block exists between the two users
  $otherParticipant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
    ->where('user_id', '!=', session('auth_user_id'))
    ->first();

$shouldBroadcast = true;

if ($otherParticipant) {

    $isBlocking = \App\Models\UserBlock::where('blocker_id', session('auth_user_id'))
        ->where('blocked_id', $otherParticipant->user_id)
        ->exists();

    $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)
        ->where('blocked_id', session('auth_user_id'))
        ->exists();

    // 🚫 STOP broadcast if any block exists
    if ($isBlocking || $isBlockedBy) {
        $shouldBroadcast = false;
    }
}

if ($shouldBroadcast) {
    broadcast(new \App\Events\MessageEdited($message))->toOthers();
}

    return response()->json($message);
}

public function deleteForEveryone($id)
{
    $message = Message::find($id);

    if(!$message) return response()->json(['error'=>'Not found'],404);

    if($message->sender_id != session('auth_user_id')){
        return response()->json(['error'=>'Unauthorized'],403);
    }

    if($message->created_at->diffInMinutes(now()) > 15){
        return response()->json(['error'=>'Expired'],403);
    }

    $message->deleted_for_everyone = true;
    $message->deleted_at = now();
    $message->save();
// remove pin if message was pinned
\App\Models\PinnedMessage::where('message_id', $message->id)->delete();
    broadcast(new \App\Events\MessageDeleted(
        $message->id,
        $message->chat_id,
        'everyone',
        session('auth_user_id')
    ));

    return response()->json(['success'=>true]);
}
public function deleteForMe($id)
{
    $message = Message::find($id);

    if(!$message){
        return response()->json(['error'=>'Not found'],404);
    }

    $userId = session('auth_user_id');

    // Laravel cast handles JSON automatically
    $deleted = $message->deleted_for_users ?? [];

    if(!is_array($deleted)){
        $deleted = json_decode($deleted, true) ?? [];
    }

    if(!in_array($userId, $deleted)){
        $deleted[] = $userId;
    }

    // IMPORTANT: DO NOT json_encode manually
    $message->deleted_for_users = $deleted;

    $message->save();
// ⭐ remove pin for THIS user only
\App\Models\PinnedMessage::where('message_id', $message->id)
    ->where('user_id', $userId)
    ->delete();
    broadcast(new \App\Events\MessageDeleted(
        $message->id,
        $message->chat_id,
        'me',
        $userId
    ));

    return response()->json(['success'=>true]);
}

public function info($id)
{
    $message = \App\Models\Message::with('media')->findOrFail($id);

    $msgDate = \Carbon\Carbon::parse($message->created_at);

    if ($msgDate->isToday()) {
        $label = "Today";
    } elseif ($msgDate->isYesterday()) {
        $label = "Yesterday";
    } elseif ($msgDate->isCurrentWeek()) {
        $label = $msgDate->format('l');
    } else {
        $label = $msgDate->format('d/m/Y');
    }
$type = 'text';
$media = null;

if ($message->media) {

    $mime = $message->media->mime_type ?? '';

    if (str_starts_with($mime, 'image')) {
        $type = 'image';
    }
    elseif (str_starts_with($mime, 'video')) {
        $type = 'video';
    }
    elseif (str_starts_with($mime, 'audio')) {
        $type = 'audio';
    }
    else {
        $type = 'file';
    }

    // send full media object
    $media = $message->media;
}

    return response()->json([
        'type' => $type,
        'media' => $media,
'file_name' => $media?->file_name,
'file_size' => $media?->file_size ?? $media?->size,
'file_ext'  => $media?->file_name ? strtoupper(pathinfo($media->file_name, PATHINFO_EXTENSION)) : 'FILE',
        'message' => $message->message,

        'time' => $msgDate->format('g:i A'),
        'date_label' => $label,

        'delivered_at' => $message->delivered_at
            ? \Carbon\Carbon::parse($message->delivered_at)->format('M d, g:i A')
            : null,

        'seen_at' => $message->seen_at
            ? \Carbon\Carbon::parse($message->seen_at)->format('M d, g:i A')
            : null,
    ]);
}

public function loadAroundMessage($messageId)
{
    $authId = session('auth_user_id');

    $message = Message::find($messageId);

    if(!$message){
        return response()->json([
            'messages' => []
        ]);
    }

    // 🚫 respect cleared chat
    $cleared = DB::table('cleared_chats')
        ->where('chat_id',$message->chat_id)
        ->where('user_id',$authId)
        ->first();

    if($cleared && strtotime($message->created_at) <= strtotime($cleared->cleared_at)){
        return response()->json([
            'messages' => []
        ]);
    }

    // load 20 messages before + 20 after
    $messages = Message::where('chat_id',$message->chat_id)
        ->where('created_at','<=',$message->created_at)
        ->orderBy('created_at','desc')
        ->limit(40)
        ->get()
        ->sortBy('created_at')
        ->values();

    return response()->json([
        'messages' => $messages
    ]);
}


}