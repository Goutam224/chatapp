<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PinnedChat extends Model
{

    protected $fillable = [
        'user_id',
        'chat_id',
        'pinned_at'
    ];

}
