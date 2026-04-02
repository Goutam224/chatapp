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
   $authId = $this->getAuthId();

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
    ->where(function($q) use ($authId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', (string) $authId);
    })
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


public function list()
{
    $authId = $this->getAuthId();

    if (!$authId) {
        return response()->json([], 401);
    }

    // ✅ Get all chat IDs where this user participates
    $chatIds = ChatParticipant::where('user_id', $authId)
        ->pluck('chat_id')
        ->toArray();

    if (empty($chatIds)) {
        return response()->json([]);
    }

    // ✅ FIX 1: No N+1 — load last message per chat in ONE query
    $lastMessages = Message::whereIn('chat_id', $chatIds)
        ->where(function ($q) use ($authId) {
            $q->whereNull('deleted_for_users')
              ->orWhereJsonDoesntContain('deleted_for_users', $authId);
        })
        ->where(function ($q) use ($authId) {
            $q->whereNull('visible_to')
              ->orWhereJsonContains('visible_to', (string) $authId);
        })
        ->orderBy('created_at', 'desc')
        ->get()
        ->groupBy('chat_id')
        ->map(fn($msgs) => $msgs->first());

    // ✅ FIX 2: Unread count respects cleared_at boundary — ONE query
    $clearedChats = \App\Models\ClearedChat::where('user_id', $authId)
        ->whereIn('chat_id', $chatIds)
        ->pluck('cleared_at', 'chat_id');

    $deletedChats = \App\Models\DeletedChat::where('user_id', $authId)
        ->whereIn('chat_id', $chatIds)
        ->pluck('deleted_at', 'chat_id');

    // ✅ FIX 3: Get other participants in ONE query
    $otherParticipants = ChatParticipant::whereIn('chat_id', $chatIds)
        ->where('user_id', '!=', $authId)
        ->with('user')
        ->get()
        ->keyBy('chat_id');

    // ✅ FIX 4: Block check in ONE query
    $otherUserIds = $otherParticipants->pluck('user_id')->toArray();

    $blocks = \App\Models\UserBlock::where(function ($q) use ($authId, $otherUserIds) {
            $q->where(function ($q2) use ($authId, $otherUserIds) {
                $q2->where('blocker_id', $authId)
                   ->whereIn('blocked_id', $otherUserIds);
            })->orWhere(function ($q2) use ($authId, $otherUserIds) {
                $q2->whereIn('blocker_id', $otherUserIds)
                   ->where('blocked_id', $authId);
            });
        })
        ->get();

    $iBlockedIds    = $blocks->where('blocker_id', $authId)->pluck('blocked_id')->toArray();
    $blockedByIds   = $blocks->where('blocked_id', $authId)->pluck('blocker_id')->toArray();

    // ✅ FIX 5: Unread count per chat — ONE query for all chats
    $allUnread = Message::whereIn('chat_id', $chatIds)
        ->where('sender_id', '!=', $authId)
        ->whereNull('seen_at')
        ->where(function ($q) use ($authId) {
            $q->whereNull('visible_to')
              ->orWhereJsonContains('visible_to', (string) $authId);
        })
        ->where(function ($q) use ($authId) {
            $q->whereNull('deleted_for_users')
              ->orWhereJsonDoesntContain('deleted_for_users', $authId);
        })
        ->select('chat_id', 'created_at', DB::raw('COUNT(*) as count'))
        ->groupBy('chat_id', 'created_at')
        ->get();

    $result = [];

    foreach ($chatIds as $chatId) {

        $participant = $otherParticipants[$chatId] ?? null;
        if (!$participant) continue;

        $otherUser = $participant->user;
        if (!$otherUser) continue;

        $isBlockedByThem = in_array($otherUser->id, $blockedByIds);
        $iBlockedThem    = in_array($otherUser->id, $iBlockedIds);

        // ✅ Get boundaries
        $clearedAt  = $clearedChats[$chatId]  ?? null;
        $deletedAt  = $deletedChats[$chatId]  ?? null;
        $boundary   = collect(array_filter([$clearedAt, $deletedAt]))->max();

        // ✅ Get last message
        $lastMsg = $lastMessages[$chatId] ?? null;

        // Skip if last message is before boundary
        if ($boundary && $lastMsg && $lastMsg->created_at <= $boundary) {
            $lastMsg = null;
        }

        // ✅ Format last message text
        $lastMessageText = null;
        if ($lastMsg) {
            if ($lastMsg->deleted_for_everyone) {
                $lastMessageText = 'This message was deleted';
            } elseif ($lastMsg->media) {
                $mime = $lastMsg->media->mime_type ?? '';
                $lastMessageText = str_starts_with($mime, 'image') ? '📷 Photo'
                    : (str_starts_with($mime, 'video') ? '🎥 Video'
                    : (str_starts_with($mime, 'audio') ? '🎵 Audio'
                    : '📄 File'));
                if ($lastMsg->message) {
                    $lastMessageText .= ' ' . $lastMsg->message;
                }
            } else {
                $lastMessageText = $lastMsg->message;
            }
        }

        // ✅ FIX 6: Correct unread count with boundary
       $unreadCount = 0;
$unreadQuery = Message::where('chat_id', $chatId)
    ->where('sender_id', '!=', $authId)
    ->whereNull('seen_at')
    ->where(function ($q) use ($authId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', (string) $authId);
    })
    ->where(function ($q) use ($authId) {
        $q->whereNull('deleted_for_users')
          ->orWhereJsonDoesntContain('deleted_for_users', $authId);
    });

// respect cleared / deleted boundary
if ($boundary) {
    $unreadQuery->where('created_at', '>', $boundary);
}

$unreadCount = $unreadQuery->count();

        // ✅ FIX 7: Format time properly — both raw and human readable
        $lastMessageTime          = $lastMsg?->created_at ?? null;
        $lastMessageTimeFormatted = null;

        if ($lastMessageTime) {
            $dt = \Carbon\Carbon::parse($lastMessageTime);
            if ($dt->isToday()) {
                $lastMessageTimeFormatted = $dt->format('g:i A');
            } elseif ($dt->isYesterday()) {
                $lastMessageTimeFormatted = 'Yesterday';
            } elseif ($dt->isCurrentWeek()) {
                $lastMessageTimeFormatted = $dt->format('l');
            } else {
                $lastMessageTimeFormatted = $dt->format('d/m/Y');
            }
        }

       $result[] = [
    'chat_id' => $chatId,

    // ✅ NEW (future-proof for groups later)
    'chat_type' => 'private',

    'user' => [
        'id'            => $otherUser->id,
        'name'          => $otherUser->name,
        'profile_photo' => $otherUser->profile_photo ?? '/default.png',
        'last_seen'     => $isBlockedByThem ? null : $otherUser->last_seen,
        'is_online'     => !$isBlockedByThem && $otherUser->last_seen
                            && \Carbon\Carbon::parse($otherUser->last_seen)
                                ->diffInSeconds(now()) < 60,
    ],

    'last_message' => $lastMessageText,

    // ✅ NEW (frontend shows "You:")
    'last_message_sender_id' => $lastMsg?->sender_id,

    // ✅ NEW (frontend shows 📷 photo / 🎥 video)
    'last_message_type' => $lastMsg?->type ?? 'text',

    'last_message_time' => $lastMessageTime,
    'last_message_time_formatted' => $lastMessageTimeFormatted,

    'unread_count' => $unreadCount,

    // ✅ NEW (for pinned chat UI later)
    'is_pinned' => false,

    'i_blocked' => $iBlockedThem,
    'blocked_by_them' => $isBlockedByThem,
];
    }

    // ✅ FIX 12: Sort by last message time — newest first
    usort($result, function ($a, $b) {
        if (!$a['last_message_time']) return 1;
        if (!$b['last_message_time']) return -1;
        return $b['last_message_time'] <=> $a['last_message_time'];
    });

    return response()->json($result);
}


public function create(Request $request)
{
    $authId = $this->getAuthId();

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
$existing = true;
    $chat = Chat::where('type', 'private')
        ->whereHas('participants', function($q) use ($authId) { $q->where('user_id', $authId); })
        ->whereHas('participants', function($q) use ($otherId) { $q->where('user_id', $otherId); })
        ->has('participants', '=', 2)
        ->first();

    if (!$chat) {
        $existing = false;
       $chat = Chat::create(['type' => 'private', 'created_by' => $authId]);

ChatParticipant::create([
    'chat_id' => $chat->id,
    'user_id' => $authId
]);

if ($authId != $otherId) {
    ChatParticipant::create([
        'chat_id' => $chat->id,
        'user_id' => $otherId
    ]);
}
    }

   return response()->json(['success' => true, 'id' => $chat->id, 'existing' => $existing]);
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
// AFTER
if (
    $msg->sender_id != $authId &&
    !is_null($msg->original_message) &&
    $msg->block_time &&
    $msg->edited_at &&
    strtotime($msg->edited_at) > strtotime($msg->block_time)
) {
    $arr['message']   = $msg->original_message;
    $arr['edited_at'] = $msg->original_edited_at; // null = wasn't edited before block (no badge), timestamp = was edited before block (show badge)
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
    $authId = $this->getAuthId();

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
if (false && !$theyBlockedMe && request()->has('mark_seen')) {

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
    $authId   = $this->getAuthId();
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
    $authId = $this->getAuthId();

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
           return response()->json([
    'success' => true,
    'message' => [
        'id'        => $message->id,
        'chat_id'   => $message->chat_id,
        'sender_id' => $message->sender_id,
        'message'   => $message->message,
        'type'      => $message->type,
        'sent_at'   => $message->sent_at,
        'sender'    => [
            'id'    => $message->sender->id,
            'name'  => $message->sender->name,
            'photo' => $message->sender->photo
                        ?? $message->sender->profile_photo
                        ?? null,
        ],
    ]
]);
        }

        if ($isBlocking) {
            $message = Message::create(['chat_id' => $request->chat_id, 'sender_id' => $authId, 'message' => $request->message, 'sent_at' => now(), 'visible_to' => [$authId]]);
          return response()->json([
    'success' => true,
    'message' => [
        'id'        => $message->id,
        'chat_id'   => $message->chat_id,
        'sender_id' => $message->sender_id,
        'message'   => $message->message,
        'type'      => $message->type,
        'sent_at'   => $message->sent_at,
        'sender'    => [
            'id'    => $message->sender->id,
            'name'  => $message->sender->name,
            'photo' => $message->sender->photo
                        ?? $message->sender->profile_photo
                        ?? null,
        ],
    ]
]);
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

return response()->json([
    'success' => true,
    'message' => [
        'id'           => $message->id,
        'chat_id'      => $message->chat_id,
        'sender_id'    => $message->sender_id,
        'message'      => $message->message,
        'type'         => $message->type,
        'reply_to'     => $message->reply_to,
        'sent_at'      => $message->sent_at,
        'delivered_at' => $message->delivered_at,
        'seen_at'      => $message->seen_at,
        'edited_at'    => $message->edited_at,
        'deleted_at'   => $message->deleted_at,
        'link_preview' => $message->linkPreview,
        'media'        => $message->media,
        'reply'        => $message->reply ? [
            'id'          => $message->reply->id,
            'message'     => $message->reply->message,
            'sender_name' => $message->reply->sender->name ?? 'User',
            'type'        => $message->reply->type,
            'media'       => $message->reply->media,
        ] : null,
        'sender' => [
            'id'    => $message->sender->id,
            'name'  => $message->sender->name,
            'photo' => $message->sender->photo
                        ?? $message->sender->profile_photo
                        ?? null,
        ],
    ]
]);
}

public function edit(Request $request, Message $message)
{
    if ($message->sender_id != $this->getAuthId()) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }

       // 15 min edit limit
    if ($message->created_at->diffInMinutes(now()) > 15) {
        return response()->json(['error' => 'Edit window expired'], 403);
    }


      $request->validate([
        'message' => 'required|string'
    ]);

    // ✅ Save original message only on first edit
    if (!$message->original_message) {
        $message->original_message = $message->message;
    }


    $otherParticipant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
        ->where('user_id', '!=', $this->getAuthId())
        ->first();

    $shouldBroadcast = true;

    if ($otherParticipant) {

        $block = \App\Models\UserBlock::where(function($q) use ($otherParticipant) {
            $q->where(function($q2) use ($otherParticipant) {
                $q2->where('blocker_id', $this->getAuthId())
                   ->where('blocked_id', $otherParticipant->user_id);
            })->orWhere(function($q2) use ($otherParticipant) {
                $q2->where('blocker_id', $otherParticipant->user_id)
                   ->where('blocked_id', $this->getAuthId());
            });
        })->orderBy('created_at','asc')->first();
// AFTER
if ($block) {

   if (!$message->block_time) {
    $message->block_time = $block->created_at;

    // store last visible message before block
    $message->original_message = $message->message;
    $message->original_edited_at = $message->edited_at;
}

    $shouldBroadcast = false;
}
    }

    $message->message   = $request->message;
    $message->edited_at = now();
    $message->save();

    if ($shouldBroadcast) {
        broadcast(new \App\Events\MessageEdited($message))->toOthers();
    }

    return response()->json($message);
}

public function deleteForEveryone($id)
{
    $message = Message::find($id);

    if (!$message)
        return response()->json(['error' => 'Not found'], 404);

    // check chat participant
    $participant = \App\Models\ChatParticipant::where('chat_id',$message->chat_id)
        ->where('user_id',$this->getAuthId())
        ->exists();

    if(!$participant)
        return response()->json(['error'=>'Not part of this chat'],403);

    if ($message->sender_id != $this->getAuthId())
        return response()->json(['error' => 'Unauthorized'], 403);

    if ($message->deleted_for_everyone)
        return response()->json(['error'=>'Message already deleted'],409);

    if ($message->created_at && $message->created_at->diffInMinutes(now()) > 15)
        return response()->json(['error' => 'Expired'], 403);


    $otherParticipant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
        ->where('user_id', '!=', $this->getAuthId())
        ->first();

    $blockExists = false;

    if ($otherParticipant) {

        $blockExists = \App\Models\UserBlock::where(function($q) use ($otherParticipant) {

            $q->where(function($q2) use ($otherParticipant) {

                $q2->where('blocker_id', $this->getAuthId())
                   ->where('blocked_id', $otherParticipant->user_id);

            })->orWhere(function($q2) use ($otherParticipant) {

                $q2->where('blocker_id', $otherParticipant->user_id)
                   ->where('blocked_id', $this->getAuthId());

            });

        })->exists();
    }


    if ($blockExists) {

        $message->deleted_for_everyone = true;
        $message->deleted_at = now();
        $message->block_time = now();

        if (is_null($message->original_message)) {
            $message->original_message = $message->message;
        }

        $message->save();

        \App\Models\PinnedMessage::where('message_id', $message->id)->delete();

        broadcast(new \App\Events\MessageDeleted($message->id,$message->chat_id,'everyone',$this->getAuthId()));

      return response()->json([
    'success' => true,
    'message_id' => $message->id,
    'chat_id' => $message->chat_id,
    'type' => 'everyone',
    'deleted_by' => $this->getAuthId(),
    'deleted_at' => $message->deleted_at,
    'blocked_context' => true
]);
    }


    $message->deleted_for_everyone = true;
    $message->deleted_at = now();
    $message->save();

    \App\Models\PinnedMessage::where('message_id', $message->id)->delete();

    broadcast(new \App\Events\MessageDeleted($message->id,$message->chat_id,'everyone',$this->getAuthId()));

 return response()->json([
    'success' => true,
    'event' => 'message.deleted',
    'message_id' => $message->id,
    'chat_id' => $message->chat_id,
    'type' => 'everyone',
    'deleted_by' => $this->getAuthId(),
    'user_id' => $this->getAuthId(),
    'deleted_at' => $message->deleted_at,
    'server_time' => now()
]);
}


public function deleteForMe($id)
{
    $message = Message::find($id);

    // 1️⃣ Message must exist
    if (!$message) {
        return response()->json([
            'success' => false,
            'error' => 'Message not found'
        ], 404);
    }

    $userId = $this->getAuthId();

    // 2️⃣ Ensure user belongs to the chat
    $participant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
        ->where('user_id', $userId)
        ->exists();

    if (!$participant) {
        return response()->json([
            'success' => false,
            'error' => 'Not part of this chat'
        ], 403);
    }

    // 3️⃣ Decode deleted_for_users safely
    $deleted = $message->deleted_for_users ?? [];

    if (!is_array($deleted)) {
        $deleted = json_decode($deleted, true) ?? [];
    }

    // 4️⃣ Prevent deleting again
    if (in_array($userId, $deleted)) {
        return response()->json([
            'success' => false,
            'error' => 'Message already deleted for this user',
            'message_id' => $message->id,
            'chat_id' => $message->chat_id
        ], 409);
    }

    // 5️⃣ Add user to deleted list
    $deleted[] = $userId;

    $message->deleted_for_users = $deleted;
    $message->save();

    // 6️⃣ Remove pinned message only for this user
    \App\Models\PinnedMessage::where('message_id', $message->id)
        ->where('user_id', $userId)
        ->delete();

    // 7️⃣ Return developer-friendly response
    return response()->json([
        'success' => true,
        'event' => 'message.deleted',
        'type' => 'me',
        'message_id' => $message->id,
        'chat_id' => $message->chat_id,
        'deleted_by' => $userId,
        'user_id' => $userId,
        'server_time' => now()

    ]);
}

public function info($id)
{
    try {

        $message = \App\Models\Message::with('media')->findOrFail($id);

        // SECURITY CHECK: user must belong to this chat
        $userId = request()->user()->id;

        $participant = \App\Models\ChatParticipant::where('chat_id', $message->chat_id)
            ->where('user_id', $userId)
            ->exists();

        if (!$participant) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized access'
            ], 403);
        }

        $msgDate = \Carbon\Carbon::parse($message->created_at);

        if ($msgDate->isToday())           $label = "Today";
        elseif ($msgDate->isYesterday())   $label = "Yesterday";
        elseif ($msgDate->isCurrentWeek()) $label = $msgDate->format('l');
        else                               $label = $msgDate->format('d/m/Y');

        $type = 'text';
        $media = null;

        if ($message->media) {
            $mime = $message->media->mime_type ?? '';

            if (str_starts_with($mime, 'image'))      $type = 'image';
            elseif (str_starts_with($mime, 'video'))  $type = 'video';
            elseif (str_starts_with($mime, 'audio'))  $type = 'audio';
            else                                      $type = 'file';

            $media = $message->media;
        }

        // FIX: hide original text if message deleted
$messageText = $message->deleted_for_everyone ? null : $message->message;

// FIX: correct file extension for text messages
$fileExt = $media?->file_name
    ? strtoupper(pathinfo($media->file_name, PATHINFO_EXTENSION))
    : null;

        return response()->json([
            'success' => true,

            // Added identifiers (important for external apps)
            'message_id' => $message->id,
            'chat_id' => $message->chat_id,
            'sender_id' => $message->sender_id,
'is_sender' => $message->sender_id === $userId,
            // your existing response fields
            'type'         => $type,
            'media'        => $media,
            'file_name'    => $media?->file_name,
            'file_size'    => $media?->file_size ?? $media?->size,
            'file_ext' => $fileExt,
'message'  => $messageText,
            'reply_to' => $message->reply_to,
            'time'         => $msgDate->format('g:i A'),
            'date_label'   => $label,

            // timestamps
            'sent_at' => $message->sent_at ? \Carbon\Carbon::parse($message->sent_at)->toISOString() : null,
            'delivered_at' => $message->delivered_at ? \Carbon\Carbon::parse($message->delivered_at)->format('M d, g:i A') : null,
            'seen_at'      => $message->seen_at ? \Carbon\Carbon::parse($message->seen_at)->format('M d, g:i A') : null,

            // additional useful message states
            'edited_at' => $message->edited_at,
            'deleted_for_everyone' => (bool) $message->deleted_for_everyone,

            // server time for client sync
            'server_time' => now()->toISOString()

        ]);

    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {

        return response()->json([
            'success' => false,
            'error' => 'Message not found'
        ], 404);

    }
}

public function loadAroundMessage($messageId)
{
    $authId  = $this->getAuthId();
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
    $authId = $this->getAuthId();
    if (!$authId) return response()->json([], 401);

    $chatIds = \App\Models\ChatParticipant::where('user_id', $authId)->pluck('chat_id');

    $messages = Message::whereIn('chat_id', $chatIds)
        ->where('sender_id', '!=', $authId)
        ->whereNull('delivered_at')
        ->where(function($q) use ($authId) {
            $q->whereNull('visible_to')->orWhereJsonContains('visible_to', (string) $authId);
        })
        ->get();

   if ($messages->isEmpty()) return response()->json([
    'success' => true,
    'updated' => 0
]);

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
$updated = 0;

    foreach ($messages as $msg) {
        if (in_array($msg->sender_id, $theyBlockedMeIds)) continue;
        if (in_array($msg->sender_id, $iBlockedThemIds))  continue;
        $boundary = $clearBoundaries[$msg->chat_id] ?? null;
        if ($boundary && $msg->created_at <= $boundary) continue;
        $msg->delivered_at = now();
        $msg->save();
        $updated++;
       broadcast(new \App\Events\MessageDelivered(
    $msg->id,
    $msg->chat_id,
    $authId,
    $msg->sender_id,
    $msg->delivered_at->toDateTimeString()
))->toOthers();
    }

   return response()->json([
    'success' => true,
    'updated' => $updated
]);
}


public function markDelivered($id)
{
    $authId = $this->getAuthId();
    $message = Message::find($id);

    if (!$message) {
        return response()->json(['success' => false, 'error' => 'Message not found'], 404);
    }

    if ($message->delivered_at) {
        return response()->json(['success' => false, 'error' => 'Already delivered'], 200);
    }

    // ✅ only receiver can mark delivered
    if ($message->sender_id === $authId) {
        return response()->json(['success' => false, 'error' => 'Sender cannot mark own message'], 403);
    }

    $message->delivered_at = now();
    $message->save();

    // ✅ fire correct event — notifies sender their message was delivered
 broadcast(new \App\Events\MessageDelivered(
    $message->id,
    $message->chat_id,
    $authId,
    $message->sender_id,
    $message->delivered_at->toDateTimeString()
))->toOthers();

    return response()->json([
        'success'      => true,
        'message_id'   => $message->id,
       'delivered_at' => $message->delivered_at->toDateTimeString(),
    ]);
}

public function markSeen($id)
{
    $authId = $this->getAuthId();
    if (!$authId) {
        return response()->json(['success' => false, 'error' => 'Unauthorized'], 401);
    }
    $message = Message::find($id);

    if (!$message) {
        return response()->json(['success' => false, 'error' => 'Message not found'], 404);
    }

    if ($message->seen_at) {
        return response()->json(['success' => false, 'error' => 'Already seen'], 200);
    }

    // ✅ only receiver can mark seen
    if ($message->sender_id === $authId) {
        return response()->json(['success' => false, 'error' => 'Sender cannot mark own message'], 403);
    }

    $message->seen_at = now();
    $message->save();

    // ✅ fire correct event — notifies sender their message was seen
    broadcast(new \App\Events\MessageSeen(
        $message->id,
        $message->chat_id,
        $authId,
             $message->sender_id,
        $message->seen_at->toDateTimeString()
    ));

    return response()->json([
        'success'    => true,
        'message_id' => $message->id,
        'seen_at'    => $message->seen_at->toDateTimeString(),
    ]);
}
}
