<?php
// app/Models/ApiClient.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiClient extends Model
{
    protected $fillable = [
        'app_name',
        'api_key',
        'status',
    ];

    // ── Relationships ────────────────────────────────────────────
    public function users()
    {
        return $this->hasMany(User::class, 'api_client_id');
    }

    // ── Helpers ──────────────────────────────────────────────────
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    // ── Find by api_key ──────────────────────────────────────────
    public static function findByKey(string $key): ?self
    {
        return static::where('api_key', $key)->first();
    }
}