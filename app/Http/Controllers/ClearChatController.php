<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ClearedChat;

class ClearChatController extends Controller
{

public function clear(Request $request)
{

$authId = $this->getAuthId();

$request->validate([
'chat_id' => 'required|exists:chats,id'
]);

ClearedChat::updateOrCreate(

[
'chat_id' => $request->chat_id,
'user_id' => $authId
],

[
'cleared_at' => now()
]

);

return response()->json([
'success' => true
]);

}

}