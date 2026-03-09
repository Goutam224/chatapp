<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StarredMessage extends Model
{
    protected $fillable = [
        'user_id',
        'message_id'
    ];

    public function message()
    {
        return $this->belongsTo(Message::class);
    }
}
