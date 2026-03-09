<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OtpVerification extends Model
{
    protected $fillable = [
        'phone',
        'otp_hash',
        'expires_at',
        'attempts',
        'verified_at'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'verified_at' => 'datetime'
    ];

    public function isExpired()
    {
        return now()->gt($this->expires_at);
    }

    public function isVerified()
    {
        return $this->verified_at !== null;
    }
}
