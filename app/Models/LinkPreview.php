<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinkPreview extends Model
{
    protected $fillable = [
        'message_id',
        'url',
        'title',
        'description',
        'image',
        'domain'
    ];

    public function message()
    {
        return $this->belongsTo(Message::class);
    }
}
