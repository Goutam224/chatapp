<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use SerializesModels;

  public $message;
public $seenMessageIds;

public function __construct(Message $message, array $seenMessageIds = [])
{
 $this->message = $message->load('sender','media','reply.sender','reply.media','linkPreview');

    $this->seenMessageIds = $seenMessageIds;
}
public function broadcastOn()
{
    $receiverId = \App\Models\ChatParticipant::where('chat_id', $this->message->chat_id)
        ->where('user_id', '!=', $this->message->sender_id)
        ->value('user_id');

    if (!$receiverId) {
        return [];
    }

    // ONLY check if RECEIVER blocked SENDER
    $receiverBlockedSender = \App\Models\UserBlock::where('blocker_id', $receiverId)
        ->where('blocked_id', $this->message->sender_id)
        ->exists();

    if ($receiverBlockedSender) {
        return []; // STOP BROADCAST ONLY in this case
    }

    return [
    new PrivateChannel('chat.' . $this->message->chat_id),
    new PrivateChannel('user.messages.' . $receiverId),
];
}


    public function broadcastAs()
    {
        return 'message.sent';
    }

public function broadcastWith()
{
    // find receiver id
    $receiverId = \App\Models\ChatParticipant::where('chat_id', $this->message->chat_id)
        ->where('user_id', '!=', $this->message->sender_id)
        ->value('user_id');

 // calculate unread count for receiver — exclude messages not visible to receiver
$unreadCount = \App\Models\Message::where('chat_id', $this->message->chat_id)
    ->where('sender_id', '!=', $receiverId)
    ->whereNull('seen_at')
    ->where(function($q) use ($receiverId) {
        $q->whereNull('visible_to')
          ->orWhereJsonContains('visible_to', (string) $receiverId);
    })
    ->count();

   return [
    'message' => [
        'id' => $this->message->id,
        'chat_id' => $this->message->chat_id,
        'sender_id' => $this->message->sender_id,
        'sender_name' => $this->message->sender->name ?? 'User',
'sender_photo' => $this->message->sender->profile_photo ?? '/default.png',
        'message' => $this->message->message,
        
            'type' => $this->message->type,

            'media' => $this->message->media,
            'link_preview' => $this->message->linkPreview,
                'reply' => $this->message->reply ? [
            'id' => $this->message->reply->id,
            'message' => $this->message->reply->message,
            'sender_name' => $this->message->reply->sender->name ?? 'User',
            'type' => $this->message->reply->type,
            'media' => $this->message->reply->media,
            'link_preview' => $this->message->linkPreview,
        ] : null,
        'sent_at' => $this->message->sent_at,
        'delivered_at' => $this->message->delivered_at,
        'seen_at' => $this->message->seen_at
        
    ],
    'seen_message_ids' => $this->seenMessageIds, // NEW: array of all IDs marked as seen
    'chat_id' => $this->message->chat_id,
    'last_message' => $this->message->message,
    'unread_count' => $unreadCount
];

}



}
