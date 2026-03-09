<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
class PinnedMessage extends Model
{

    public $timestamps = false;

    protected $fillable = [
        'message_id',
        'user_id',
        'chat_id',
        'pinned_at'
    ];
public function message()
{
    return $this->belongsTo(\App\Models\Message::class, 'message_id');
}

}