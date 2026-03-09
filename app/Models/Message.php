<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
   protected $fillable = [
        'chat_id',
        'sender_id',
        'message',
        'reply_to',
        'type',
        'sent_at',
        'delivered_at',
        'seen_at',
        'edited_at',
        'deleted_for_everyone',
        'deleted_for_users',
        'visible_to'
    ];

    protected $casts = [
        'deleted_for_users' => 'array',
        'visible_to' => 'array',
    ];


    public function chat()
{
    return $this->belongsTo(Chat::class);
}

public function sender()
{
    return $this->belongsTo(User::class, 'sender_id');
}

public function media()
{
    return $this->hasOne(Media::class);
}

public function reply()
{
    return $this->belongsTo(Message::class,'reply_to');
}

public function repliedMessages()
{
    return $this->hasMany(Message::class,'reply_to');
}

}
