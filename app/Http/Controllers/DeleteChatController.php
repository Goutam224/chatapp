<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DeletedChat;

class DeleteChatController extends Controller
{

public function delete(Request $request)
{

$authId = session('auth_user_id');

$request->validate([
'chat_id' => 'required|exists:chats,id'
]);

$now = now();

// ✅ Mark chat as deleted
DeletedChat::updateOrCreate(
[
    'chat_id' => $request->chat_id,
    'user_id' => $authId
],
[
    'deleted_at' => $now
]
);

// ✅ Also clear all messages up to this point
\App\Models\ClearedChat::updateOrCreate(
[
    'chat_id' => $request->chat_id,
    'user_id' => $authId
],
[
    'cleared_at' => $now
]
);

return response()->json([
'success' => true
]);

}

}
