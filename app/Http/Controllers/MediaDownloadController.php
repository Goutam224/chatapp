<?php

namespace App\Http\Controllers;

use App\Models\Message;
use Illuminate\Support\Facades\Storage;
use App\Helpers\AuthHelper;

class MediaDownloadController extends Controller
{
   public function serve(Message $message)
{
    $user = AuthHelper::user();

    if (!$user) {
        abort(403);
    }

    // 🔐 Verify user is participant of this chat
    $isParticipant = $message->chat
        ->participants()
        ->where('user_id', $user->id)
        ->exists();

    if (!$isParticipant) {
        abort(403);
    }
$media = $message->media;

if (!$media || empty($media->file_path)) {
    abort(404);
}

 $path = $media->file_path;

/*
|--------------------------------------------------------------------------
| SUPPORT BOTH OLD (public) AND NEW (private) MEDIA
|--------------------------------------------------------------------------
*/

if (Storage::disk('private')->exists($path)) {

    $fullPath = Storage::disk('private')->path($path);

} elseif (Storage::disk('public')->exists($path)) {

    $fullPath = Storage::disk('public')->path($path);

} else {

    abort(404);

}
$size = filesize($fullPath);
$mime = $media->mime_type;

$start = 0;
$end = $size - 1;

if (request()->hasHeader('Range')) {

    $range = request()->header('Range');
    preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);

    $start = intval($matches[1]);
    if (!empty($matches[2])) {
        $end = intval($matches[2]);
    }

    if ($end > $size - 1) {
        $end = $size - 1;
    }

    $length = $end - $start + 1;

    return response()->stream(function () use ($fullPath, $start, $length) {
        $handle = fopen($fullPath, 'rb');
        fseek($handle, $start);

        $remaining = $length;
        while ($remaining > 0 && !feof($handle)) {
            $read = ($remaining > 8192) ? 8192 : $remaining;
            echo fread($handle, $read);
            flush();
            $remaining -= $read;
        }

        fclose($handle);
    }, 206, [
        'Content-Type' => $mime,
        'Content-Length' => $length,
        'Content-Range' => "bytes $start-$end/$size",
        'Accept-Ranges' => 'bytes',
    ]);
}

return response()->stream(function () use ($fullPath) {
    readfile($fullPath);
}, 200, [
    'Content-Type' => $mime,
    'Content-Length' => $size,
    'Accept-Ranges' => 'bytes',
    'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
'Pragma' => 'no-cache',
'Expires' => '0',
]);
}

public function thumbnail(Message $message)
{
    $user = AuthHelper::user();

    if (!$user) {
        abort(403);
    }

    // verify chat participant
    $isParticipant = $message->chat
        ->participants()
        ->where('user_id', $user->id)
        ->exists();

    if (!$isParticipant) {
        abort(403);
    }

    $media = $message->media;

    if (!$media || !$media->thumbnail_path) {
        abort(404);
    }

    $path = $media->thumbnail_path;

    // support private + old public
    if (Storage::disk('private')->exists($path)) {

        $fullPath = Storage::disk('private')->path($path);

    } elseif (Storage::disk('public')->exists($path)) {

        $fullPath = Storage::disk('public')->path($path);

    } else {

        abort(404);

    }

  return response()->file($fullPath, [
    'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma' => 'no-cache',
    'Expires' => '0',
]);
}
}