<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UploadSession extends Model
{
    protected $fillable = [

        'upload_uuid',
        'user_id',
        'chat_id',
        'file_name',
        'file_path',
        'mime_type',
        'file_size',
        'uploaded_bytes',
        'status'

    ];

}