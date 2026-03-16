<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
class Message extends Model
{

  public const TYPE_TEXT = 'text';
    public const TYPE_LINK = 'link';
    public const TYPE_SYSTEM = 'system';


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


    public function getMessageAttribute($value)
{
    if (!$value) {
        return $value;
    }

    try {
        return Crypt::decryptString($value);
    } catch (\Throwable $e) {
        // old plaintext messages
        return $value;
    }
}

public function setMessageAttribute($value)
{
    if (!$value) {
        $this->attributes['message'] = $value;
        return;
    }

    $this->attributes['message'] = Crypt::encryptString($value);
}


public function getOriginalMessageAttribute($value)
{
    if (!$value) {
        return $value;
    }

    try {
        return Crypt::decryptString($value);
    } catch (\Throwable $e) {
        return $value;
    }
}

public function setOriginalMessageAttribute($value)
{
    if (!$value) {
        $this->attributes['original_message'] = $value;
        return;
    }

    $this->attributes['original_message'] = Crypt::encryptString($value);
}


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

public function linkPreview()
{
    return $this->hasOne(\App\Models\LinkPreview::class);
}

}
