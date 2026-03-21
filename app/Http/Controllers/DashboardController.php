<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Chat;
use App\Models\Message;
use App\Models\UserBlock;
use App\Models\ClearedChat;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $userId = $this->getAuthId();

        $user = User::find($userId);

        // =========================================================
        // 1. Load chats (same as before — untouched)
        // =========================================================
        $chats = Chat::whereHas('participants', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->whereNotExists(function ($q) use ($userId) {
                $q->select(DB::raw(1))
                  ->from('deleted_chats')
                  ->whereColumn('deleted_chats.chat_id', 'chats.id')
                  ->where('deleted_chats.user_id', $userId);
            })
            ->with([
                'participants.user',
                // ✅ Load last visible message per chat — first() used in PHP below
                'messages' => function ($q) use ($userId) {
                    $q->where(function ($query) use ($userId) {
                            $query->whereNull('visible_to')
                                  ->orWhereJsonContains('visible_to', (string) $userId);
                        })
                     ->where(function ($query) use ($userId) {
    $query->whereNull('deleted_for_users')
          ->orWhereRaw("NOT JSON_CONTAINS(deleted_for_users, '" . (int)$userId . "')");
})
                        ->orderBy('created_at', 'desc')
                        ->with('media');
                },
            ])
            ->get();

        // =========================================================
        // 2. Pinned chats (same as before — untouched)
        // =========================================================
        $pinnedChatIds = \App\Models\PinnedChat::where('user_id', $userId)
            ->orderBy('pinned_at', 'desc')
            ->pluck('chat_id')
            ->toArray();

        $pinned   = $chats->filter(fn($c) => in_array($c->id, $pinnedChatIds))
                          ->sortBy(fn($c) => array_search($c->id, $pinnedChatIds))
                          ->values();

        $unpinned = $chats->filter(fn($c) => !in_array($c->id, $pinnedChatIds))
                          ->values();

        $chats = $pinned->concat($unpinned);

        // =========================================================
        // 3. Block data (same as before — untouched)
        // =========================================================
        $iBlockedUsers = UserBlock::where('blocker_id', $userId)
            ->pluck('blocked_id')
            ->toArray();

        $blockedByUsers = UserBlock::where('blocked_id', $userId)
            ->pluck('blocker_id')
            ->toArray();

        // =========================================================
        // 4. ✅ NEW — Batch load cleared_chats for ALL chats at once
        //    Previously blade ran this query per chat in the loop
        // =========================================================
        $chatIds = $chats->pluck('id')->toArray();

        $clearedChats = ClearedChat::where('user_id', $userId)
            ->whereIn('chat_id', $chatIds)
            ->pluck('cleared_at', 'chat_id'); // keyed by chat_id

        // =========================================================
        // 5. ✅ NEW — Batch unread counts for ALL chats at once
        //    Previously blade ran a separate Message query per chat
        // =========================================================
        $unreadCounts = Message::where('sender_id', '!=', $userId)
            ->whereIn('chat_id', $chatIds)
            ->whereNull('seen_at')
            ->whereNull('deleted_at')
            ->where(function ($q) use ($userId) {
                $q->whereNull('visible_to')
                  ->orWhereJsonContains('visible_to', (string) $userId);
            })
            ->where(function ($q) use ($userId) {
                $q->whereNull('deleted_for_users')
                  ->orWhereRaw("JSON_CONTAINS(deleted_for_users, '\"$userId\"') = 0");
            })
            ->select('chat_id', DB::raw('COUNT(*) as count'), DB::raw('MIN(created_at) as oldest'))
            ->groupBy('chat_id')
            ->get()
            ->keyBy('chat_id');

        // Apply cleared_at filter to unread counts in PHP (no extra queries)
        $finalUnreadCounts = [];
        foreach ($chatIds as $chatId) {
            $clearTime = $clearedChats[$chatId] ?? null;
            $row       = $unreadCounts[$chatId] ?? null;

            if (!$row) {
                $finalUnreadCounts[$chatId] = 0;
                continue;
            }

            // If cleared_at exists and oldest unread is before it → recount
            if ($clearTime && $row->oldest <= $clearTime) {
                $finalUnreadCounts[$chatId] = Message::where('chat_id', $chatId)
                    ->where('sender_id', '!=', $userId)
                    ->whereNull('seen_at')
                    ->where('created_at', '>', $clearTime)
                    ->where(function ($q) use ($userId) {
                        $q->whereNull('visible_to')
                          ->orWhereJsonContains('visible_to', (string) $userId);
                    })
                    ->count();
            } else {
                $finalUnreadCounts[$chatId] = $row->count;
            }
        }

        // =========================================================
        // 6. ✅ NEW — Batch load block relationships for sidebar
        //    Previously blade ran UserBlock query per chat
        // =========================================================
        $otherUserIds = $chats->map(function ($chat) use ($userId) {
            return optional(
                $chat->participants->where('user_id', '!=', $userId)->first()
            )->user_id;
        })->filter()->values()->toArray();

        // Who blocked me (affects profile photo display)
        $blockedByMeMap    = array_flip($iBlockedUsers);
        $blockedByThemMap  = array_flip($blockedByUsers);

        // ✅ Batch load earliest block time per other user — one query, no per-chat queries
        $blockTimes = \App\Models\UserBlock::where(function ($q) use ($userId, $otherUserIds) {
                $q->where(function ($q2) use ($userId, $otherUserIds) {
                    $q2->where('blocker_id', $userId)
                       ->whereIn('blocked_id', $otherUserIds);
                })->orWhere(function ($q2) use ($userId, $otherUserIds) {
                    $q2->whereIn('blocker_id', $otherUserIds)
                       ->where('blocked_id', $userId);
                });
            })
            ->orderBy('created_at', 'asc')
            ->get()
            ->groupBy(function ($block) use ($userId) {
                return $block->blocker_id === (int) $userId
                    ? $block->blocked_id
                    : $block->blocker_id;
            })
            ->map(fn ($group) => $group->first()->created_at);

        // =========================================================
        // 7. ✅ NEW — Build sidebar data per chat (all in PHP, zero extra queries)
        // =========================================================
        $sidebarData = [];

        foreach ($chats as $chat) {

            $otherParticipant = $chat->participants
                ->where('user_id', '!=', $userId)
                ->first();

            $otherUser = $otherParticipant->user ?? null;
            $otherId   = $otherUser->id ?? null;

            // Block status for photo
            $isBlockedByThem = $otherId && isset($blockedByThemMap[$otherId]);

            $photo = $isBlockedByThem
                ? '/default.png'
                : ($otherUser->profile_photo ?? '/default.png');

            // Last visible message (already loaded via eager load, limit 1)
            $clearTime      = $clearedChats[$chat->id] ?? null;
            $lastMessage    = $chat->messages->first();

            // Filter out system messages and clear-chat cutoff
            $visibleMessage = null;
            if ($lastMessage) {
                $isSystemMsg = in_array($lastMessage->message, [
                    'You blocked this contact.',
                    'You unblocked this contact.',
                ]);

                $isBeforeClear = $clearTime &&
                    $lastMessage->created_at <= $clearTime;

                $isHiddenFromMe = $lastMessage->visible_to &&
                    !in_array($userId, (array) $lastMessage->visible_to);

                if (!$isSystemMsg && !$isBeforeClear && !$isHiddenFromMe) {
                    $visibleMessage = $lastMessage;
                }
            }

            // ✅ Block time for this chat's other user (from batch loaded above)
            $sidebarBlockTime = $otherId ? ($blockTimes[$otherId] ?? null) : null;

            // Sidebar text
          // Sidebar text
$sidebarText = '';
if ($visibleMessage) {
if ($visibleMessage->deleted_for_everyone) {
    $sidebarText = 'This message was deleted';
} elseif ($visibleMessage->media) {
        $mime        = $visibleMessage->media->mime_type ?? '';
        $mediaLabel  = '';
        if (str_starts_with($mime, 'image'))      $mediaLabel = '📷 Photo';
        elseif (str_starts_with($mime, 'video'))  $mediaLabel = '🎥 Video';
        elseif (str_starts_with($mime, 'audio'))  $mediaLabel = '🎵 Audio';
        else $mediaLabel = '📄 ' . ($visibleMessage->media->file_name ?? 'Document');
        $sidebarText = $mediaLabel . ($visibleMessage->message ? ' ' . $visibleMessage->message : '');
} elseif ($visibleMessage->message) {
    if (
        $visibleMessage->sender_id != $userId &&
        $visibleMessage->edited_at &&
        !is_null($visibleMessage->original_message) &&
        $visibleMessage->block_time &&
        strtotime($visibleMessage->edited_at) > strtotime($visibleMessage->block_time)
    ) {
        // edit happened after block — always show original regardless of current block state
        $sidebarText = $visibleMessage->original_message;
    } else {
        $sidebarText = $visibleMessage->message;
    }
}
}

            $unreadCount = $finalUnreadCounts[$chat->id] ?? 0;

            $sidebarData[$chat->id] = [
                'other_user'      => $otherUser,
                'photo'           => $photo,
                'visible_message' => $visibleMessage,
                'sidebar_text'    => $sidebarText,
                'unread_count'    => $unreadCount,
            ];
        }

        return view('dashboard.index', compact(
            'user',
            'chats',
            'iBlockedUsers',
            'blockedByUsers',
            'pinnedChatIds',
            'sidebarData'       // ✅ New — all sidebar data pre-computed
        ));
    }
}