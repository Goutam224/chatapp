<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Media extends Model
{

    protected $table = 'media';

    protected $fillable = [

        'message_id',

        'file_name',

        'file_path',

        'mime_type',

        'file_size',

        'duration',

        'thumbnail_path'

    ];

    public function message()
    {
        return $this->belongsTo(Message::class);
    }

    public function getUrlAttribute()
    {
        return asset('storage/'.$this->file_path);
    }

}
