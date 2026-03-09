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
        'account_status'
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

}
