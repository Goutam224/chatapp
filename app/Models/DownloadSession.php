<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DownloadSession extends Model
{
    protected $fillable = [
        'user_id',
        'message_id',
        'downloaded_bytes',
        'total_bytes',
        'completed',
        'device_id'
    ];
}