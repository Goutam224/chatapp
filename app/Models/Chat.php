<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chat extends Model
{
     protected $table = 'chats';

    public $timestamps = false;
    protected $fillable = [
    'type',
    'created_by'
];

    public function participants()
{
    return $this->hasMany(ChatParticipant::class);
}

public function messages()
{
    return $this->hasMany(Message::class);
}

}
