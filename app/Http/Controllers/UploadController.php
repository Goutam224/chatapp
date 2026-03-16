<?php
namespace App\Http\Controllers;

use App\Models\UploadSession;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Models\Message;
use App\Models\Media;
use App\Events\MessageSent;
use Illuminate\Support\Facades\Auth;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Illuminate\Support\Facades\Log;
class UploadController extends Controller
{

private function ffmpegExists(): bool
{
    $result = shell_exec('where ffmpeg'); // Windows
    if (!$result) {
        $result = shell_exec('which ffmpeg'); // Linux
    }

    return !empty($result);
}

public function start(Request $request)
{
    $uuid = (string) Str::uuid();

    $session = UploadSession::create([

        'upload_uuid' => $uuid,

        'user_id' => session('auth_user_id'),

        'chat_id' => $request->chat_id,

        'file_name' => $request->file_name,

        'mime_type' => $request->mime_type,

        'file_size' => $request->file_size,

        'uploaded_bytes' => 0,

        'status' => 'uploading'

    ]);

    return response()->json([

        'upload_uuid' => $uuid,

        'uploaded_bytes' => 0

    ]);
}


public function chunk(Request $request)
{
    $session = UploadSession::where(
        'upload_uuid',
        $request->upload_uuid
    )->first();

    if(!$session)
    {
        return response()->json([
            'success'=>false
        ],200);
    }

    if($session->status === 'paused')
    {
        return response()->json([
            'success'=>false,
            'paused'=>true
        ],200);
    }

    $file = $request->file('chunk');

    if(!$file)
    {
        return response()->json([
            'success'=>false
        ],200);
    }

    $path = storage_path(
        'app/uploads/'.$session->upload_uuid.'.part'
    );

    // ALWAYS append chunk
    $written = file_put_contents(
        $path,
        file_get_contents(
            $file->getRealPath()
        ),
        FILE_APPEND
    );

    if($written === false)
    {
        return response()->json([
            'success'=>false,
            'error'=>'write_failed'
        ],500);
    }

    // CRITICAL FIX — get REAL filesize
    clearstatcache(true, $path);

    $session->uploaded_bytes =
    filesize($path);

    $session->status = 'uploading';

    $session->save();

    return response()->json([
        'success'=>true,
        'uploaded_bytes'=>$session->uploaded_bytes,
        'file_size'=>$session->file_size
    ],200);
}
public function status($uuid)
{
    $session = UploadSession::where(
        'upload_uuid',
        $uuid
    )->first();

    if(!$session)
    {
        return response()->json([
            'exists' => false,
            'uploaded_bytes' => 0,
            'file_size' => 0,
            'status' => 'not_found',
            'can_resume' => false
        ],200);
    }

    return response()->json([
        'exists' => true,

        // CRITICAL — frontend resume offset
        'uploaded_bytes' => (int)$session->uploaded_bytes,

        'file_size' => (int)$session->file_size,

        'status' => $session->status,

        // CRITICAL — allow resume when paused OR uploading
        'can_resume' => in_array(
            $session->status,
            ['paused','uploading']
        )
    ],200);
}
public function reset(Request $request)
{
    $session = UploadSession::where(
        'upload_uuid',
        $request->upload_uuid
    )->firstOrFail();

    // delete partial file so chunks start fresh
    $tempPath = storage_path(
        'app/uploads/' .
        $session->upload_uuid .
        '.part'
    );

    if(file_exists($tempPath))
        unlink($tempPath);

    $session->update([
        'uploaded_bytes' => 0,
        'status' => 'uploading'
    ]);

    return response()->json(['success' => true]);
}

public function finish(Request $request)
{
    $session = UploadSession::where(
        'upload_uuid',
        $request->upload_uuid
    )->first();

    if(!$session)
    {
        return response()->json([
            'success'=>false
        ],200);
    }

    // STOP finish if paused
    if($session->status === 'paused')
    {
        return response()->json([
            'success'=>false,
            'paused'=>true
        ],200);
    }

    $tempPath = storage_path(
        'app/uploads/'.$session->upload_uuid.'.part'
    );

    // CRITICAL FIX
    if(!file_exists($tempPath))
    {
        return response()->json([
            'success'=>false,
            'file_missing'=>true
        ],200);
    }

    $folder='file';

    if(str_starts_with($session->mime_type,'image/'))
        $folder='image';
    else if(str_starts_with($session->mime_type,'video/'))
        $folder='video';
    else if(str_starts_with($session->mime_type,'audio/'))
        $folder='audio';

  $ext = pathinfo($session->file_name, PATHINFO_EXTENSION);
$finalPath =
    'chat/'.$folder.'/'.
    $session->upload_uuid.'.'.$ext;

Storage::disk('private')->put(
    $finalPath,
    file_get_contents($tempPath)
);

// CRITICAL: validate written file matches expected size
$writtenSize = Storage::disk('private')->size($finalPath);
if($writtenSize !== (int)$session->file_size)
{
    Storage::disk('private')->delete($finalPath);
    unlink($tempPath);
    return response()->json([
        'success' => false,
        'error' => 'file_size_mismatch',
        'expected' => $session->file_size,
        'got' => $writtenSize
    ], 200);
}

unlink($tempPath);

  // ================= BLOCK CHECK =================
    $userId = session('auth_user_id');
    $otherParticipant = \App\Models\ChatParticipant::where('chat_id', $session->chat_id)
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

    $message = Message::create([
        'chat_id'    => $session->chat_id,
        'sender_id'  => $userId,
        'message'    => $request->caption,
        'type'       => $folder,
        'visible_to' => ($blockedByMe || $blockedMe) ? [$userId] : null,
    ]);

   $media = Media::create([
    'message_id'=>$message->id,
    'file_name'=>$session->file_name,
    'file_path'=>$finalPath,
    'mime_type'=>$session->mime_type,
    'file_size'=>$session->file_size
]);

/*
|--------------------------------------------------------------------------
| THUMBNAIL GENERATION (SAFE - DOES NOT TOUCH UPLOAD SYSTEM)
|--------------------------------------------------------------------------
*/
Log::info('Final Path: ' . $finalPath);
Log::info('Absolute Path: ' . Storage::disk('private')->path($finalPath));
Log::info('File Exists: ' . (file_exists(Storage::disk('private')->path($finalPath)) ? 'YES' : 'NO'));
$thumbnailPath = null;

$fullFilePath = Storage::disk('private')->path($finalPath);
$thumbnailDir = Storage::disk('private')->path('chat/thumbnails');

if (!file_exists($thumbnailDir)) {
    mkdir($thumbnailDir, 0755, true);
}

$thumbnailName = Str::uuid().'.jpg';
$thumbnailFullPath = $thumbnailDir.'/'.$thumbnailName;

try {

    // IMAGE
    if (str_starts_with($session->mime_type, 'image/')) {

        $manager = new ImageManager(new Driver());
        $image = $manager->read($fullFilePath);
        $image->cover(300, 300)->toJpeg(75)->save($thumbnailFullPath);

        if(file_exists($thumbnailFullPath)) {
            $thumbnailPath = 'chat/thumbnails/'.$thumbnailName;
        }
    }

    // VIDEO
    elseif (str_starts_with($session->mime_type, 'video/')) {

        $ffmpegPath = "C:\\ffmpeg\\bin\\ffmpeg.exe";

        if(file_exists($ffmpegPath)) {

            $command = "\"{$ffmpegPath}\" -i \"{$fullFilePath}\" -ss 00:00:01.000 -vframes 1 \"{$thumbnailFullPath}\" -y 2>&1";
            shell_exec($command);

            if(file_exists($thumbnailFullPath)) {
                $thumbnailPath = 'chat/thumbnails/'.$thumbnailName;
            }
        }
    }

} catch (\Throwable $e) {
    Log::error('Thumbnail error: '.$e->getMessage());
}

if($thumbnailPath) {
    $media->thumbnail_path = $thumbnailPath;
    $media->save();
}

    $message->load('media');
if (!$blockedByMe && !$blockedMe) {
        broadcast(new MessageSent($message))->toOthers();
    }

   $session->update([
    'status'=>'completed',
    'file_path'=>$finalPath,
    'uploaded_bytes'=>$session->file_size
]);

    return response()->json([
    'success'=>true,
    'message'=>$message,
    'upload_uuid'=>$session->upload_uuid
],200);
}

public function cancel($uuid)
{
    try
    {
        $session = UploadSession::where(
            'upload_uuid',
            $uuid
        )->first();

        if(!$session)
        {
            return response()->json([
                'success'=>true
            ],200);
        }

        // CRITICAL: update safely
        $session->update([
            'status'=>'paused'
        ]);

        return response()->json([
            'success'=>true,
            'uploaded_bytes'=>$session->uploaded_bytes
        ],200);

    }
    catch(\Throwable $e)
    {
        

        return response()->json([
            'success'=>false
        ],200);
    }
}

 public function pending($chatId)
    {
        // return both uploading *and* paused sessions so that the client
        // can render something to resume; duplicates are filtered on the JS side
        return response()->json([
            'uploads' => UploadSession::where('chat_id', $chatId)
                ->whereIn('status', ['uploading','paused'])
                ->where('user_id', Auth::id()) // only sender
                ->get()
        ]);
    }

    public function destroy($uuid)
{
    $session = UploadSession::where('upload_uuid', $uuid)->first();

    if(!$session){
        return response()->json(['success'=>true]);
    }

    // delete temp file
    $tempPath = storage_path(
        'app/uploads/'.$uuid.'.part'
    );

    if(file_exists($tempPath)){
        unlink($tempPath);
    }

    // delete db record
    $session->delete();

    return response()->json(['success'=>true]);
}

}