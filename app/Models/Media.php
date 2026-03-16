<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\URL;
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


    public function getFileNameAttribute($value)
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


public function setFileNameAttribute($value)
{
    if (!$value) {
        $this->attributes['file_name'] = $value;
        return;
    }

    $this->attributes['file_name'] = Crypt::encryptString($value);
}

 public function getUrlAttribute()
{
    return URL::temporarySignedRoute(
        'media.serve',
        now()->addMinutes(5),
        ['message' => $this->message_id]
    );
}

}
