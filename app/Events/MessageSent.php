<?php

namespace App\Events;

use App\Models\Message;
use App\Models\ChatParticipant;
use App\Models\UserBlock;
use App\Models\DeletedChat;
use App\Models\ClearedChat;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use SerializesModels;

    public $message;
    public $seenMessageIds;
    private $receiverId = null; // ✅ store once

    public function __construct(Message $message, array $seenMessageIds = [])
    {
        $this->message = $message->load(
            'sender',
            'media',
            'reply.sender',
            'reply.media',
            'reply.linkPreview', // ✅ fixed
            'linkPreview'
        );
        $this->seenMessageIds = $seenMessageIds;

        // ✅ query once here
        $this->receiverId = ChatParticipant::where('chat_id', $message->chat_id)
            ->where('user_id', '!=', $message->sender_id)
            ->value('user_id');
    }

 public function broadcastOn()
{
    if (!$this->receiverId) return [];

    // ✅ check BOTH directions
    $anyBlockExists = UserBlock::where(function($q) {
        $q->where(function($q2) {
            $q2->where('blocker_id', $this->receiverId)
               ->where('blocked_id', $this->message->sender_id);
        })->orWhere(function($q2) {
            $q2->where('blocker_id', $this->message->sender_id)
               ->where('blocked_id', $this->receiverId);
        });
    })->exists();

    if ($anyBlockExists) return [];

    // ✅ ONLY receiver's personal channel
    // sender already has message from API response
    // chat channel removed — prevents sender seeing their own event
    return [
        new PrivateChannel('user.messages.' . $this->receiverId),
    ];
}
    public function broadcastAs()
    {
        return 'message.sent';
    }

    public function broadcastWith()
    {
        // ✅ reuse stored receiverId
        $deletedAt = DeletedChat::where('chat_id', $this->message->chat_id)
            ->where('user_id', $this->receiverId)
            ->value('deleted_at');

        $clearedAt = ClearedChat::where('chat_id', $this->message->chat_id)
            ->where('user_id', $this->receiverId)
            ->value('cleared_at');

        $unreadQuery = Message::where('chat_id', $this->message->chat_id)
            ->where('sender_id', '!=', $this->receiverId)
            ->whereNull('seen_at')
            ->where(function($q) {
                $q->whereNull('visible_to')
                  ->orWhereJsonContains('visible_to', (string) $this->receiverId);
            });

        $values = array_filter([$deletedAt, $clearedAt]);
        $boundary = !empty($values) ? max($values) : null;
        if ($boundary) $unreadQuery->where('created_at', '>', $boundary);

        $unreadCount = $unreadQuery->count();

        return [
            'message' => [
                'id'           => $this->message->id,
                'chat_id'      => $this->message->chat_id,
                'sender_id'    => $this->message->sender_id,
                'sender_name'  => $this->message->sender->name ?? 'User',
              'sender_photo' => $this->message->sender->photo
    ?? $this->message->sender->profile_photo
    ?? '/default.png',
                'message'      => $this->message->message,
                'type'         => $this->message->type,
                'media'        => $this->message->media,
                'link_preview' => $this->message->linkPreview,
                'reply' => $this->message->reply ? [
                    'id'           => $this->message->reply->id,
                    'message'      => $this->message->reply->message,
                    'sender_name'  => $this->message->reply->sender->name ?? 'User',
                    'type'         => $this->message->reply->type,
                    'media'        => $this->message->reply->media,
                    'link_preview' => $this->message->reply->linkPreview, // ✅ fixed
                ] : null,
                'sent_at'      => $this->message->sent_at,
                'delivered_at' => $this->message->delivered_at,
                'seen_at'      => $this->message->seen_at,
            ],
            'seen_message_ids' => $this->seenMessageIds,
            'chat_id'          => $this->message->chat_id,
            // ✅ fixed null for media
            'last_message'     => $this->message->message
                ?? match($this->message->type) {
                    'image' => '📷 Photo',
                    'video' => '🎥 Video',
                    'audio' => '🎵 Audio',
                    'file'  => '📄 File',
                    default => 'Message'
                },
            'unread_count' => $unreadCount,
        ];
    }
}
