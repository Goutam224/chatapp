<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeletedChat extends Model
{
    protected $table = 'deleted_chats';

    public $timestamps = false;

    protected $fillable = [
        'chat_id',
        'user_id',
        'deleted_at'
    ];
}
?>