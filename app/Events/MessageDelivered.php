<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class MessageDelivered implements ShouldBroadcastNow
{
  public function __construct(
    public int $messageId,
    public int $chatId,
    public int $receiverId,
    public int $senderId,
    public string $deliveredAt
) {}

    public function broadcastOn()
{
    return new PrivateChannel('user.messages.' . $this->senderId);
}

   

    public function broadcastAs(): string
    {
        return 'message.delivered';
    }

    public function broadcastWith(): array
    {
        return [
            'message_id'   => $this->messageId,
            'chat_id'      => $this->chatId,
            'receiver_id'  => $this->receiverId,
            'delivered_at' => $this->deliveredAt,
        ];
    }
}
