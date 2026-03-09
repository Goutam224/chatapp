<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use App\Models\User;

class UserBlocked implements ShouldBroadcastNow
{
    public int $blockerId;
    public int $blockedId;
    public string $action;

    public string $blockerPhoto;
    public string $blockedPhoto;

    public function __construct(int $blockerId, int $blockedId, string $action)
    {
        $this->blockerId = $blockerId;
        $this->blockedId = $blockedId;
        $this->action = $action;

        $blocker = User::find($blockerId);
        $blocked = User::find($blockedId);

        $this->blockerPhoto = ($blocker && $blocker->profile_photo)
            ? url($blocker->profile_photo)
            : url('/default.png');

        $this->blockedPhoto = ($blocked && $blocked->profile_photo)
            ? url($blocked->profile_photo)
            : url('/default.png');
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('user.' . $this->blockedId),
            new PrivateChannel('user.' . $this->blockerId),
        ];
    }

    public function broadcastAs()
    {
        return 'user.blocked';
    }
}