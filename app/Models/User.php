<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'phone',
        'name',
        'about',
        'profile_photo',
        'is_phone_verified',
        'account_status',

           // ── NEW for token exchange ───────────────────────────────
        'external_id',
        'api_client_id',
        'photo',
        'email',
        'username',


    ];

    public function blockedUsers()
{
    return $this->belongsToMany(User::class, 'user_blocks',
        'blocker_id', 'blocked_id');
}

public function blockedBy()
{
    return $this->belongsToMany(User::class, 'user_blocks',
        'blocked_id', 'blocker_id');
}

public function hasBlocked($userId)
{
    return \App\Models\UserBlock::where('blocker_id', $this->id)
        ->where('blocked_id', $userId)
        ->exists();
}

public function isBlockedBy($userId)
{
    return \App\Models\UserBlock::where('blocker_id', $userId)
        ->where('blocked_id', $this->id)
        ->exists();
}

  // ── NEW relationship ─────────────────────────────────────────
    public function apiClient()
    {
        return $this->belongsTo(ApiClient::class, 'api_client_id');
    }

    // ── Helper: is this an external user? ───────────────────────
    public function isExternalUser(): bool
    {
        return !is_null($this->api_client_id);
    }


}
