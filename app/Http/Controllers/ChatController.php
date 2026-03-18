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

    $users = User::where('id', '!=', $authId)->get();

    if ($users->isEmpty()) {
        return response()->json([]);
    }

    $userIds = $users->pluck('id')->toArray();

    $allBlocks = \App\Models\UserBlock::where(function ($q) use ($authId, $userIds) {
            $q->where(function ($q2) use ($authId, $userIds) {
                $q2->where('blocker_id', $authId)
                   ->whereIn('blocked_id', $userIds);
            })->orWhere(function ($q2) use ($authId, $userIds) {
                $q2->whereIn('blocker_id', $userIds)
                   ->where('blocked_id', $authId);
            });
        })
        ->orderBy('created_at', 'asc')
        ->get();

    $blockedByMe   = $allBlocks->where('blocker_id', $authId)->keyBy('blocked_id');
    $blockedByThem = $allBlocks->where('blocked_id', $authId)->keyBy('blocker_id');

    $blockTimes = [];
    foreach ($allBlocks as $block) {
        $otherId = $block->blocker_id == $authId ? $block->blocked_id : $block->blocker_id;
        if (!isset($blockTimes[$otherId])) {
            $blockTimes[$otherId] = $block->created_at;
        }
    }

    $chats = Chat::where('type', 'private')
        ->whereHas('participants', fn($q) => $q->where('user_id', $authId))
        ->whereHas('participants', fn($q) => $q->whereIn('user_id', $userIds))
        ->with(['participants' => fn($q) => $q->where('user_id', '!=', $authId)])
        ->get();

    $chatByUser = [];
    foreach ($chats as $chat) {
        $otherParticipant = $chat->participants->first();
        if ($otherParticipant) {
            $chatByUser[$otherParticipant->user_id] = $chat;
        }
    }

    $chatIds = collect($chatByUser)->pluck('id')->toArray();

    $unreadCounts = Message::whereIn('chat_id', $chatIds)
        ->where('sender_id', '!=', $authId)
        ->whereNull('seen_at')
        ->select('chat_id', DB::raw('COUNT(*) as count'))
        ->groupBy('chat_id')
        ->pluck('count', 'chat_id');

    $clearedChats = \App\Models\ClearedChat::where('user_id', $authId)
        ->whereIn('chat_id', $chatIds)
        ->pluck('cleared_at', 'chat_id');

    $lastMessages = Message::whereIn('chat_id', $chatIds)
        ->where(function ($q) use ($authId) {
            $q->whereNull('deleted_for_users')
              ->orWhereJsonDoesntContain('deleted_for_users', $authId);
        })
        ->orderBy('created_at', 'desc')
        ->get()
        ->groupBy('chat_id')
        ->map(fn($msgs) => $msgs->first());

    foreach ($users as $user) {

        $isBlockedByThem = isset($blockedByThem[$user->id]);

        if ($isBlockedByThem) {
            $user->profile_photo = null;
            $user->about         = null;
            $user->last_seen     = null;
            $user->last_message  = null;
            $user->unread_count  = 0;
            continue;
        }

        $chat = $chatByUser[$user->id] ?? null;

        if (!$chat) {
            $user->unread_count = 0;
            $user->last_message = null;
            continue;
        }

        $chatId    = $chat->id;
        $clearTime = $clearedChats[$chatId] ?? null;

        $user->unread_count = $unreadCounts[$chatId] ?? 0;

        $last = $lastMessages[$chatId] ?? null;

        if ($clearTime && $last && $last->created_at <= $clearTime) {
            $last = null;
        }

        if (!$last) {
            $user->last_message = null;
            continue;
        }

        if ($last->deleted_for_everyone == 1) {
            $user->last_message = 'This message was deleted';
            continue;
        }

        $blockTime = $blockTimes[$user->id] ?? null;

        if (
            $blockTime &&
            $last->edited_at &&
            $last->sender_id != $authId &&
            $last->edited_at > $blockTime &&
            !is_null($last->original_message)
        ) {
            $user->last_message = $last->original_message;
        } else {
            $user->last_message = $last->message;
        }
    }

    return response()->json($users);
}

public function create(Request $request)
{
    $authId = session('auth_user_id');

    if (!$authId) {
        return response()->json(['success' => false, 'error' => 'Unauthorized - Session or auth missing'], 401);
    }

    $otherId = $request->input('user_id');

    if (!$otherId) {
        return response()->json(['success' => false, 'error' => 'User id missing'], 400);
    }

    $otherUser = User::find($otherId);
    if (!$otherUser) {
        return response()->json(['success' => false, 'error' => 'User not found'], 404);
    }

    $chat = Chat::where('type', 'private')
        ->whereHas('participants', function($q) use ($authId) { $q->where('user_id', $authId); })
        ->whereHas('participants', function($q) use ($otherId) { $q->where('user_id', $otherId); })
        ->has('participants', '=', 2)
        ->first();

    if (!$chat) {
        $chat = Chat::create(['type' => 'private', 'created_by' => $authId]);
        ChatParticipant::create(['chat_id' => $chat->id, 'user_id' => $authId]);
        ChatParticipant::create(['chat_id' => $chat->id, 'user_id' => $otherId]);
    }

    return response()->json(['success' => true, 'id' => $chat->id]);
}

// =========================================================
// ✅ SHARED: build message query with all filters applied
// =========================================================
private function buildMessageQuery(Chat $chat, $authId, $clear, $deletedAt)
{
    $query = Message::where('chat_id', $chat->id);

    if ($clear) {
        $query->where('created_at', '>', $clear);
    }

    if ($deletedAt) {
        $query->where('created_at', '>', $deletedAt);
    }

    $query->where(function($q) use ($authId) {
            $q->whereNull('visible_to')
              ->orWhereJsonContains('visible_to', $authId);
        })
        ->where(function($q) use ($authId) {
            $q->whereNull('deleted_for_users')
              ->orWhereJsonDoesntContain('deleted_for_users', $authId);
        });

    return $query;
}

// =========================================================
// ✅ SHARED: format messages collection for response
// =========================================================
private function formatMessages($messages, $authId, $pinnedIds, $starredIds, $downloadedIds)
{
    return $messages->map(function ($msg) use ($pinnedIds, $starredIds, $authId, $downloadedIds) {
        $arr               = $msg->toArray();
        $arr['link_preview'] = $msg->linkPreview;
        $arr['is_pinned']  = in_array($msg->id, $pinnedIds);
        $arr['is_starred'] = in_array($msg->id, $starredIds);
        $arr['sender_name'] = $msg->sender->name ?? 'User';
        $arr['downloaded'] = $msg->sender_id == $authId ? 1 : (in_array($msg->id, $downloadedIds) ? 1 : 0);

        // ✅ original_message only exists when edited during a block — always show it
        if (
            $msg->sender_id != $authId &&
            $msg->edited_at &&
            !is_null($msg->original_message)
        ) {
            $arr['message']   = $msg->original_message;
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
}

public function open(Chat $chat)
{
    $authId = session('auth_user_id');

    $isParticipant = ChatParticipant::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->exists();

    if (!$isParticipant) {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 403);
    }

    $otherParticipant = ChatParticipant::where('chat_id', $chat->id)
        ->where('user_id', '!=', $authId)
        ->first();

    $theyBlockedMe = false;
    $iBlocked      = false;
    $blockTime     = null;

    if ($otherParticipant) {
        $blocks = \App\Models\UserBlock::where(function ($q) use ($authId, $otherParticipant) {
                $q->where(function ($q2) use ($authId, $otherParticipant) {
                    $q2->where('blocker_id', $otherParticipant->user_id)
                       ->where('blocked_id', $authId);
                })->orWhere(function ($q2) use ($authId, $otherParticipant) {
                    $q2->where('blocker_id', $authId)
                       ->where('blocked_id', $otherParticipant->user_id);
                });
            })
            ->get();

        $theyBlockedMe = $blocks->contains(fn($b) => $b->blocker_id == $otherParticipant->user_id && $b->blocked_id == $authId);
        $iBlocked      = $blocks->contains(fn($b) => $b->blocker_id == $authId && $b->blocked_id == $otherParticipant->user_id);
        $blockTime     = null;
    }

    if (!$theyBlockedMe && request()->has('mark_seen')) {

        $clearBoundary = \App\Models\ClearedChat::where('chat_id', $chat->id)
            ->where('user_id', $authId)
            ->value('cleared_at');

        $undeliveredQuery = Message::where('chat_id', $chat->id)
            ->where('sender_id', '!=', $authId)
            ->whereNull('delivered_at')
            ->where(function($q) use ($authId) {
                $q->whereNull('visible_to')
                  ->orWhereJsonContains('visible_to', $authId);
            });

        if ($clearBoundary) $undeliveredQuery->where('created_at', '>', $clearBoundary);

        foreach ($undeliveredQuery->get() as $msg) {
            $msg->delivered_at = now();
            $msg->save();
            broadcast(new \App\Events\MessageSent($msg))->toOthers();
        }

        $unseenQuery = Message::where('chat_id', $chat->id)
            ->where('sender_id', '!=', $authId)
            ->whereNull('seen_at')
            ->where(function($q) use ($authId) {
                $q->whereNull('visible_to')
                  ->orWhereJsonContains('visible_to', $authId);
            });

        if ($clearBoundary) $unseenQuery->where('created_at', '>', $clearBoundary);

        $unseen = $unseenQuery->get();

        if ($unseen->isNotEmpty()) {
            $seenIds = [];
            $seenAt  = now();
            foreach ($unseen as $msg) {
                $msg->seen_at = $seenAt;
                $msg->save();
                $seenIds[] = $msg->id;
            }
            $latestMessage = Message::where('chat_id', $chat->id)->orderBy('created_at', 'desc')->first();
            if ($latestMessage) {
                broadcast(new \App\Events\MessageSent($latestMessage, $seenIds))->toOthers();
            }
        }
    }

    $deletedAt = \App\Models\DeletedChat::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->value('deleted_at');

    \App\Models\DeletedChat::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->delete();

    $clear = \App\Models\ClearedChat::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->value('cleared_at');

    // ✅ PAGINATION: load only last 40 messages
    $limit = 40;

    $query = $this->buildMessageQuery($chat, $authId, $clear, $deletedAt);

    // Count total for has_more flag
    $totalCount = (clone $query)->count();

    $messages = $query
        ->with(['sender', 'media', 'reply.sender', 'reply.media', 'linkPreview'])
        ->orderBy('created_at', 'desc')
        ->limit($limit)
        ->get()
        ->reverse()
        ->values();

    $has_more = $totalCount > $limit;

    // Oldest loaded message created_at — used as cursor for loading more
    $oldest_id = $messages->first()?->id ?? null;

    $downloadedIds = DownloadSession::where('user_id', $authId)
        ->whereIn('message_id', $messages->pluck('id'))
        ->where('completed', 1)
        ->pluck('message_id')
        ->toArray();

    $pinnedQuery = PinnedMessage::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->with('message.media');

    if ($clear) {
        $pinnedQuery->whereHas('message', fn($q) => $q->where('created_at', '>', $clear));
    }

    $pinned = $pinnedQuery
        ->orderBy('pinned_at')
        ->get()
        ->map(function($p) {
            if (!$p->message) return null;
            $msg = $p->message;
            return ['id' => $msg->id, 'message' => $msg->message, 'type' => $msg->type, 'media' => $msg->media, 'pinned_at' => $p->pinned_at];
        })
        ->filter()
        ->values();

    $pinnedIds  = $pinned->pluck('id')->toArray();
    $starredIds = \App\Models\StarredMessage::where('user_id', $authId)->pluck('message_id')->toArray();

    $messages = $this->formatMessages($messages, $authId, $pinnedIds, $starredIds, $downloadedIds);

    return response()->json([
        'success'         => true,
        'messages'        => $messages,
        'has_more'        => $has_more,
        'oldest_id'       => $oldest_id,
        'pinned_messages' => $pinned,
        'they_blocked_me' => $theyBlockedMe,
        'i_blocked'       => $iBlocked,
    ]);
}

// =========================================================
// ✅ NEW: Load older messages when user scrolls to top
// =========================================================
public function loadMore(Chat $chat, Request $request)
{
    $authId   = session('auth_user_id');
    $beforeId = $request->query('before_id'); // load messages before this ID
    $limit    = 40;

    $isParticipant = ChatParticipant::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->exists();

    if (!$isParticipant) {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 403);
    }

    $clear     = \App\Models\ClearedChat::where('chat_id', $chat->id)->where('user_id', $authId)->value('cleared_at');
    $deletedAt = null; // already cleaned on open

    $query = $this->buildMessageQuery($chat, $authId, $clear, $deletedAt);

    // Load messages older than the oldest currently loaded
    if ($beforeId) {
        $beforeMessage = Message::find($beforeId);
        if ($beforeMessage) {
            $query->where('created_at', '<', $beforeMessage->created_at);
        }
    }

    $totalOlder = (clone $query)->count();

    $messages = $query
        ->with(['sender', 'media', 'reply.sender', 'reply.media', 'linkPreview'])
        ->orderBy('created_at', 'desc')
        ->limit($limit)
        ->get()
        ->reverse()
        ->values();

    $has_more  = $totalOlder > $limit;
    $oldest_id = $messages->first()?->id ?? null;

    $downloadedIds = DownloadSession::where('user_id', $authId)
        ->whereIn('message_id', $messages->pluck('id'))
        ->where('completed', 1)
        ->pluck('message_id')
        ->toArray();

    $starredIds = \App\Models\StarredMessage::where('user_id', $authId)->pluck('message_id')->toArray();

    // For pinned — reuse existing pinned IDs (no need to reload)
    $pinnedIds = PinnedMessage::where('chat_id', $chat->id)
        ->where('user_id', $authId)
        ->pluck('message_id')
        ->toArray();

    $messages = $this->formatMessages($messages, $authId, $pinnedIds, $starredIds, $downloadedIds);

    return response()->json([
        'success'   => true,
        'messages'  => $messages,
        'has_more'  => $has_more,
        'oldest_id' => $oldest_id,
    ]);
}

public function send(Request $request)
{
    $authId = session('auth_user_id');

    $request->validate([
        'chat_id'  => 'required|exists:chats,id',
        'message'  => 'required|string|max:5000',
        'reply_to' => 'nullable|exists:messages,id'
    ]);

    $isParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', $authId)
        ->exists();

    if (!$isParticipant) {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 403);
    }

    $otherParticipant = ChatParticipant::where('chat_id', $request->chat_id)
        ->where('user_id', '!=', $authId)
        ->first();

    if ($otherParticipant) {
        $isBlocking  = \App\Models\UserBlock::where('blocker_id', $authId)->where('blocked_id', $otherParticipant->user_id)->exists();
        $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)->where('blocked_id', $authId)->exists();

        if ($isBlockedBy) {
            $message = Message::create(['chat_id' => $request->chat_id, 'sender_id' => $authId, 'message' => $request->message, 'sent_at' => now(), 'visible_to' => [$authId]]);
            return response()->json(['success' => true, 'message' => $message->load('sender')]);
        }

        if ($isBlocking) {
            $message = Message::create(['chat_id' => $request->chat_id, 'sender_id' => $authId, 'message' => $request->message, 'sent_at' => now(), 'visible_to' => [$authId]]);
            return response()->json(['success' => true, 'message' => $message->load('sender')]);
        }
    }

    \App\Models\DeletedChat::where('chat_id', $request->chat_id)->where('user_id', '!=', $authId)->delete();

    $type = 'text';
    if (preg_match('/https?:\/\/\S+/i', $request->message)) $type = 'link';

    $message = Message::create([
        'chat_id'   => $request->chat_id,
        'sender_id' => $authId,
        'message'   => $request->message,
        'reply_to'  => $request->reply_to,
        'type'      => $type,
        'sent_at'   => now()
    ]);

    \App\Services\LinkPreviewService::generate($message);
    $message = Message::with('sender', 'linkPreview')->find($message->id);
    broadcast(new \App\Events\MessageSent($message->load('linkPreview')))->toOthers();

    return response()->json(['success' => true, 'message' => $message->load('sender', 'linkPreview')]);
}

public function edit(Request $request, Message $message)
{
    if ($message->sender_id != session('auth_user_id')) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }

    if (is_null($message->original_message)) {
        $message->original_message = $message->message;
    }

    $message->message   = $request->message;
    $message->edited_at = now();
    $message->save();

    $message = Message::find($message->id);

    $otherParticipant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
        ->where('user_id', '!=', session('auth_user_id'))
        ->first();

    $shouldBroadcast = true;

    if ($otherParticipant) {
        $isBlocking  = \App\Models\UserBlock::where('blocker_id', session('auth_user_id'))->where('blocked_id', $otherParticipant->user_id)->exists();
        $isBlockedBy = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)->where('blocked_id', session('auth_user_id'))->exists();
        if ($isBlocking || $isBlockedBy) $shouldBroadcast = false;
    }

    if ($shouldBroadcast) broadcast(new \App\Events\MessageEdited($message))->toOthers();

    return response()->json($message);
}

public function deleteForEveryone($id)
{
    $message = Message::find($id);
    if (!$message) return response()->json(['error' => 'Not found'], 404);
    if ($message->sender_id != session('auth_user_id')) return response()->json(['error' => 'Unauthorized'], 403);
    if ($message->created_at->diffInMinutes(now()) > 15) return response()->json(['error' => 'Expired'], 403);

    $message->deleted_for_everyone = true;
    $message->deleted_at           = now();
    $message->save();

    \App\Models\PinnedMessage::where('message_id', $message->id)->delete();
    broadcast(new \App\Events\MessageDeleted($message->id, $message->chat_id, 'everyone', session('auth_user_id')));

    return response()->json(['success' => true]);
}

public function deleteForMe($id)
{
    $message = Message::find($id);
    if (!$message) return response()->json(['error' => 'Not found'], 404);

    $userId  = session('auth_user_id');
    $deleted = $message->deleted_for_users ?? [];
    if (!is_array($deleted)) $deleted = json_decode($deleted, true) ?? [];
    if (!in_array($userId, $deleted)) $deleted[] = $userId;

    $message->deleted_for_users = $deleted;
    $message->save();

    \App\Models\PinnedMessage::where('message_id', $message->id)->where('user_id', $userId)->delete();
    broadcast(new \App\Events\MessageDeleted($message->id, $message->chat_id, 'me', $userId));

    return response()->json(['success' => true]);
}

public function info($id)
{
    $message = \App\Models\Message::with('media')->findOrFail($id);
    $msgDate = \Carbon\Carbon::parse($message->created_at);

    if ($msgDate->isToday())           $label = "Today";
    elseif ($msgDate->isYesterday())   $label = "Yesterday";
    elseif ($msgDate->isCurrentWeek()) $label = $msgDate->format('l');
    else                               $label = $msgDate->format('d/m/Y');

    $type = 'text'; $media = null;
    if ($message->media) {
        $mime = $message->media->mime_type ?? '';
        if (str_starts_with($mime, 'image'))      $type = 'image';
        elseif (str_starts_with($mime, 'video'))  $type = 'video';
        elseif (str_starts_with($mime, 'audio'))  $type = 'audio';
        else                                       $type = 'file';
        $media = $message->media;
    }

    return response()->json([
        'type'         => $type,
        'media'        => $media,
        'file_name'    => $media?->file_name,
        'file_size'    => $media?->file_size ?? $media?->size,
        'file_ext'     => $media?->file_name ? strtoupper(pathinfo($media->file_name, PATHINFO_EXTENSION)) : 'FILE',
        'message'      => $message->message,
        'time'         => $msgDate->format('g:i A'),
        'date_label'   => $label,
        'delivered_at' => $message->delivered_at ? \Carbon\Carbon::parse($message->delivered_at)->format('M d, g:i A') : null,
        'seen_at'      => $message->seen_at ? \Carbon\Carbon::parse($message->seen_at)->format('M d, g:i A') : null,
    ]);
}

public function loadAroundMessage($messageId)
{
    $authId  = session('auth_user_id');
    $message = Message::find($messageId);

    if (!$message) return response()->json(['messages' => []]);

    $cleared = DB::table('cleared_chats')
        ->where('chat_id', $message->chat_id)
        ->where('user_id', $authId)
        ->first();

    if ($cleared && strtotime($message->created_at) <= strtotime($cleared->cleared_at)) {
        return response()->json(['messages' => []]);
    }

    $messages = Message::where('chat_id', $message->chat_id)
        ->where('created_at', '<=', $message->created_at)
        ->orderBy('created_at', 'desc')
        ->limit(40)
        ->get()
        ->sortBy('created_at')
        ->values();

    return response()->json(['messages' => $messages]);
}

public function markAllDelivered()
{
    $authId = session('auth_user_id');
    if (!$authId) return response()->json([], 401);

    $chatIds = \App\Models\ChatParticipant::where('user_id', $authId)->pluck('chat_id');

    $messages = Message::whereIn('chat_id', $chatIds)
        ->where('sender_id', '!=', $authId)
        ->whereNull('delivered_at')
        ->where(function($q) use ($authId) {
            $q->whereNull('visible_to')->orWhereJsonContains('visible_to', (string) $authId);
        })
        ->get();

    if ($messages->isEmpty()) return response()->json(['success' => true]);

    $senderIds  = $messages->pluck('sender_id')->unique()->toArray();
    $msgChatIds = $messages->pluck('chat_id')->unique()->toArray();

    $blocks = \App\Models\UserBlock::where(function ($q) use ($authId, $senderIds) {
            $q->where(function ($q2) use ($authId, $senderIds) {
                $q2->where('blocker_id', $authId)->whereIn('blocked_id', $senderIds);
            })->orWhere(function ($q2) use ($authId, $senderIds) {
                $q2->whereIn('blocker_id', $senderIds)->where('blocked_id', $authId);
            });
        })
        ->get();

    $theyBlockedMeIds = $blocks->where('blocked_id', $authId)->pluck('blocker_id')->toArray();
    $iBlockedThemIds  = $blocks->where('blocker_id', $authId)->pluck('blocked_id')->toArray();

    $clearBoundaries = \App\Models\ClearedChat::where('user_id', $authId)
        ->whereIn('chat_id', $msgChatIds)
        ->pluck('cleared_at', 'chat_id');

    foreach ($messages as $msg) {
        if (in_array($msg->sender_id, $theyBlockedMeIds)) continue;
        if (in_array($msg->sender_id, $iBlockedThemIds))  continue;
        $boundary = $clearBoundaries[$msg->chat_id] ?? null;
        if ($boundary && $msg->created_at <= $boundary) continue;
        $msg->delivered_at = now();
        $msg->save();
        broadcast(new \App\Events\MessageSent($msg))->toOthers();
    }

    return response()->json(['success' => true]);
}

}