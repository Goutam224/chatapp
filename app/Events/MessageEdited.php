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
        $this->message = $message;
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

            'edited_at' => $this->message->edited_at,

            // FIX: do NOT use ->format()
            'delivered_at' => $this->message->delivered_at,
            'seen_at' => $this->message->seen_at,
        ]
    ];
}


}
