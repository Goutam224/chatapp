<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class MessageEdited implements ShouldBroadcastNow
{
    public $message;

    public function __construct(Message $message)
    {
       $this->message = $message->load('linkPreview');
    }

    public function broadcastOn()
    {
        return new PrivateChannel('chat.' . $this->message->chat_id);
    }

    public function broadcastAs()
    {
        return 'message.edited';
    }

public function broadcastWith()
{
    return [
        'message' => [
            'id' => $this->message->id,
            'chat_id' => $this->message->chat_id,
            'sender_id' => $this->message->sender_id,
            'message' => $this->message->message,

            'edited_at' => $this->message->edited_at?->toDateTimeString(),
'delivered_at' => $this->message->delivered_at?->toDateTimeString(),
'seen_at' => $this->message->seen_at?->toDateTimeString(),
            'link_preview' => $this->message->linkPreview,
              'is_edited'  => true,                                          // ← added
            'is_deleted' => (bool) $this->message->deleted_for_everyone,   // ← added
            'reply_to'   => $this->message->reply_to,    

        ]
    ];
}


}
