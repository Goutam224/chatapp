<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClearedChat extends Model
{

protected $fillable = [
'chat_id',
'user_id',
'cleared_at'
];

}