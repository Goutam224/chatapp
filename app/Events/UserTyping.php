<?php

namespace App\Events;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Log;

class UserTyping implements ShouldBroadcastNow
{
    public $chatId;
    public $userId;

    public function __construct($chatId, $userId)
    {
        $this->chatId = $chatId;
        $this->userId = $userId;
        
        Log::info('UserTyping event created', [
            'chat_id' => $chatId,
            'user_id' => $userId
        ]);
    }

public function broadcastOn()
{
    // Find the other participant in this chat
    $receiverId = \App\Models\ChatParticipant::where('chat_id', $this->chatId)
        ->where('user_id', '!=', $this->userId)
        ->value('user_id');

    if (!$receiverId) {
        return [];
    }

    // BLOCK CHECK (both directions)
    $isBlocked = \App\Models\UserBlock::where(function($q) use ($receiverId) {
            $q->where('blocker_id', $receiverId)
              ->where('blocked_id', $this->userId);
        })
        ->orWhere(function($q) use ($receiverId) {
            $q->where('blocker_id', $this->userId)
              ->where('blocked_id', $receiverId);
        })
        ->exists();

    if ($isBlocked) {
        Log::info('Typing blocked due to user block relationship', [
            'sender' => $this->userId,
            'receiver' => $receiverId
        ]);
        return []; // STOP BROADCAST
    }

    $channel = 'chat.' . $this->chatId;

    Log::info('Broadcasting typing on channel: ' . $channel);

    return new PrivateChannel($channel);
}

   public function broadcastAs()
   {
       Log::info('Broadcasting as: user.typing');
       return 'user.typing';
   }

   public function broadcastWith()
   {
       return [
           'userId' => $this->userId,
           'chatId' => $this->chatId
       ];
   }

}

