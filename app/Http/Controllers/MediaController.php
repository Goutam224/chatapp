<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Message;
use App\Models\Media;
use App\Models\ChatParticipant;
use App\Helpers\AuthHelper;
use App\Events\MessageSent;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
class MediaController extends Controller
{

    public function send(Request $request)
    {

        $userId = $this->getAuthId();

        if(!$userId)
            return response()->json(['error'=>'Unauthorized'],403);


        $request->validate([

            'chat_id' => 'required|exists:chats,id',

            'file' => 'required|file|max:1048576'

            // 1048576 KB = 1GB max support ready

        ]);
// ================= BLOCK CHECK START =================

$otherParticipant = \App\Models\ChatParticipant::where('chat_id', $request->chat_id)
    ->where('user_id', '!=', $userId)
    ->first();

$blockedByMe = false;
$blockedMe = false;
if ($otherParticipant) {

    $blockedByMe = \App\Models\UserBlock::where('blocker_id', $userId)
        ->where('blocked_id', $otherParticipant->user_id)
        ->exists();

    $blockedMe = \App\Models\UserBlock::where('blocker_id', $otherParticipant->user_id)
        ->where('blocked_id', $userId)
        ->exists();

}
// ================= BLOCK CHECK END =================

Log::info('MEDIA BLOCK DEBUG', [
    'userId'           => $userId,
    'chat_id'          => $request->chat_id,
    'otherParticipant' => $otherParticipant?->user_id ?? 'NULL',
    'blockedByMe'      => $blockedByMe,
    'blockedMe'        => $blockedMe,
]);

// EITHER blocked → save silently, visible only to sender, no broadcast
// Replace the blocked section with this:

if ($blockedMe || $blockedByMe) {
    $file   = $request->file('file');
    $mime   = $file->getMimeType();
    $type   = $this->detectType($mime);
    $folder = match($type) {
        'image' => 'chat/images',
        'video' => 'chat/videos',
        'audio' => 'chat/audio',
        default => 'chat/files'
    };
    $path = $file->store($folder, 'public');

    $message = Message::create([
        'chat_id'    => $request->chat_id,
        'sender_id'  => $userId,
        'message'    => $request->caption ?: null,
        'type'       => $type,
        'sent_at'    => now(),
        'visible_to' => [$userId],
    ]);

    Media::create([
        'message_id' => $message->id,
        'file_name'  => $file->getClientOriginalName(),
        'file_path'  => $path,
        'mime_type'  => $mime,
        'file_size'  => $file->getSize()
    ]);

    // ✅ return early - NO broadcast
    return response()->json([
        'success' => true,
        'message' => $message->load('sender', 'media')
    ]);
    // broadcast never reaches here ✅
}

        $file = $request->file('file');

        $mime = $file->getMimeType();

        $type = $this->detectType($mime);


        $folder = match($type){

            'image' => 'chat/images',

            'video' => 'chat/videos',

            'audio' => 'chat/audio',

            default => 'chat/files'
        };


       // STOP if client cancelled upload
if(connection_aborted())
{
    return response()->json([
        'success'=>false,
        'cancelled'=>true
    ]);
}

// store file safely
$path = $file->store($folder,'public');

// check again after storing
if(connection_aborted())
{
    // delete stored file if upload was cancelled
    Storage::disk('public')->delete($path);

    return response()->json([
        'success'=>false,
        'cancelled'=>true
    ]);
}


        // Create message safely
        $message = Message::create([

            'chat_id' => $request->chat_id,

            'sender_id' => $userId,

           'message' => $request->caption ?: null,


            'type' => $type,

            'sent_at' => now()

        ]);

// Create media record
Media::create([
    'message_id' => $message->id,
    'file_name'  => $file->getClientOriginalName(),
    'file_path'  => $path,
    'mime_type'  => $mime,
    'file_size'  => $file->getSize()
]);

$message->load('sender', 'media');



broadcast(new MessageSent($message))->toOthers();


        return response()->json([

            'success'=>true,

            'message'=>$message

        ]);

    }


    private function detectType($mime)
    {

        if(str_starts_with($mime,'image/'))
            return 'image';

        if(str_starts_with($mime,'video/'))
            return 'video';

        if(str_starts_with($mime,'audio/'))
            return 'audio';

        return 'file';

    }

}
