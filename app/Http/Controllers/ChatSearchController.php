<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ChatSearchController extends Controller
{
public function search(Request $request)
{

    $authId = session('auth_user_id');
    $query = trim($request->q);

  

$clearedChats = DB::table('cleared_chats')
    ->where('user_id', $authId)
    ->pluck('cleared_at','chat_id');
    if(!$query){
        return response()->json([
            'messages' => [],
            'contacts' => []
        ]);
    }

    /*
    |----------------------------------------
    | FIND CHATS WHERE MESSAGE MATCHES
    |----------------------------------------
    */
if(strlen($query) < 3){

    // short queries use LIKE
    $messageMatches = Message::where('message','like',"%$query%")
        ->where('sender_id','!=',0)
        ->limit(20)
        ->get();

}else{

    // longer queries use FULLTEXT
    $messageMatches = Message::whereRaw(
        "MATCH(message) AGAINST (? IN BOOLEAN MODE)",
        [$query.'*']
    )
    ->where('sender_id','!=',0)
    ->limit(20)
    ->get();

}

    /*
    |----------------------------------------
    | FIND USERS
    |----------------------------------------
    */

    $users = User::where('name','like',"%$query%")
        ->orWhere('phone','like',"%$query%")
        ->limit(20)
        ->get();

    $messageResults = [];
    $userResults = [];

    /*
    |----------------------------------------
    | USER RESULTS
    |----------------------------------------
    */

    foreach($users as $user){

        $chat = DB::table('chat_participants as cp1')
            ->join('chat_participants as cp2','cp1.chat_id','=','cp2.chat_id')
            ->where('cp1.user_id',$authId)
            ->where('cp2.user_id',$user->id)
            ->select('cp1.chat_id')
            ->first();

        if(!$chat) continue;

        $userResults[] = [
            'type' => 'user',
            'chat_id' => $chat->chat_id,
            'name' => $user->name,
            'photo' => $user->profile_photo ?? '/default.png',
            'preview' => $user->phone ?? ''
        ];
    }

    /*
    |----------------------------------------
    | MESSAGE RESULTS
    |----------------------------------------
    */
foreach($messageMatches as $msg){

    // 🚫 Skip deleted for everyone
    if($msg->deleted_for_everyone){
        continue;
    }

 if(!empty($msg->deleted_for_users)){

    $deletedUsers = is_array($msg->deleted_for_users)
        ? $msg->deleted_for_users
        : json_decode($msg->deleted_for_users,true);

    if(in_array($authId, $deletedUsers)){
        continue;
    }
}
    // 🚫 Skip messages before cleared chat
    if(isset($clearedChats[$msg->chat_id])){

        $clearedAt = strtotime($clearedChats[$msg->chat_id]);
        $msgTime = strtotime($msg->created_at);

        if($msgTime <= $clearedAt){
            continue;
        }
    }

   $chat = Chat::with('participants.user')->find($msg->chat_id);

if(!$chat){
    continue;
}

if(!$chat->participants || $chat->participants->isEmpty()){
    continue;
}

$participant = $chat->participants
    ->firstWhere('user_id','!=',$authId);

if(!$participant || !$participant->user){
    continue;
}

$otherUser = $participant->user;

 $date = \Carbon\Carbon::parse($msg->created_at);

if ($date->isToday()) {
    $formattedDate = "Today";
} elseif ($date->isYesterday()) {
    $formattedDate = "Yesterday";
} elseif ($date->isCurrentWeek()) {
    $formattedDate = $date->format('l'); // Monday, Tuesday
} else {
    $formattedDate = $date->format('d/m/Y');
}

$messageResults[] = [
    'type' => 'message',
    'chat_id' => $chat->id,
    'message_id' => $msg->id,
    'name' => $otherUser->name,
    'photo' => $otherUser->profile_photo ?? '/default.png',
    'preview' => $msg->message,
    'date' => $formattedDate
];
    }

    return response()->json([
        'messages' => $messageResults,
        'contacts' => $userResults
    ]);

}

}