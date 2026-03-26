<?php

/**
 * UserOnlineStatusUpdated.php
 *
 * Place this file in: app/Events/UserOnlineStatusUpdated.php
 *
 * PURPOSE:
 * Broadcast to all other users when someone's last_seen is updated.
 * This powers the real-time green dot / online status for external API users.
 *
 * TRIGGERED BY:
 *   - UpdateLastSeen middleware (auto, on every API request)
 *   - POST /user/update-last-seen (manual, from frontend heartbeat)
 */

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class UserOnlineStatusUpdated implements ShouldBroadcastNow
{
    public User $user;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function broadcastOn(): array
    {
        return [
            // Global presence channel — all users who are watching online dots
            new Channel('global.presence'),

            // Personal user channel — for direct status updates
            new Channel('user.' . $this->user->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'user.online_status';
    }

    public function broadcastWith(): array
    {
        return [
            'user_id'   => $this->user->id,
            'last_seen' => $this->user->last_seen,
            'is_online' => true,
        ];
    }
}