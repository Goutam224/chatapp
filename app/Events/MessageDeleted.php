<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class MessageDeleted implements ShouldBroadcastNow
{
    public $messageId;
    public $chatId;
    public $type;
    public $userId;

    public function __construct($messageId, $chatId, $type, $userId)
    {
        $this->messageId = $messageId;
        $this->chatId = $chatId;
        $this->type = $type;
        $this->userId = $userId;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('chat.' . $this->chatId);
    }

    public function broadcastAs()
    {
        return 'message.deleted';
    }

   public function broadcastWith()
{
    return [
        'message_id' => $this->messageId,
        'chat_id' => $this->chatId,     // new field
        'type' => $this->type,
        'user_id' => $this->userId,     // keep this (UI already uses it)
        'deleted_by' => $this->userId   // optional alias for developers
    ];
}
}
