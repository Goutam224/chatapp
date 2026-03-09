<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use TusPhp\Tus\Server;
use App\Models\UploadSession;
use App\Models\Message;
use App\Models\Media;
use Illuminate\Support\Facades\Storage;
use App\Helpers\AuthHelper;
class TusController extends Controller
{

public function server(Request $request)
{
  $server = new \TusPhp\Tus\Server('file');

$server->setUploadDir(
    storage_path('app/tus')
);

$server->setCache(
    new \TusPhp\Cache\FileStore(
        storage_path('app/tus-cache')
    )
);

$server->setApiPath('/tus/upload');

    return $server->serve()->send();
}


    public function complete(Request $request)
{
    $user = AuthHelper::user();

    if(!$user)
        return response()->json(['error'=>'Unauthorized'], 403);

    // extract uuid from upload_url
    $uploadUrl = $request->upload_url;
    $uuid = basename($uploadUrl);

    $tusFile = storage_path('app/tus/' . $uuid);
if(!file_exists($tusFile))
    return response()->json([
        'error' => 'File not found',
        'looked_for' => $tusFile,
        'files_in_dir' => scandir(storage_path('app/tus'))
    ], 404);

    $fileName = $request->file_name ?? $uuid;
    $mimeType = $request->file_type ?? 'application/octet-stream';
    $fileSize = $request->file_size ?? 0;

    $path = 'chat/files/' . $fileName;

    \Illuminate\Support\Facades\Storage::disk('public')
        ->put(
            $path,
            file_get_contents($tusFile)
        );

    $message = \App\Models\Message::create([
        'chat_id'   => $request->chat_id,
        'sender_id' => $user->id,
        'type'      => 'file',
        'sent_at'   => now()
    ]);

    \App\Models\Media::create([
        'message_id' => $message->id,
        'file_name'  => $fileName,
        'file_path'  => $path,
        'mime_type'  => $mimeType,
        'file_size'  => $fileSize
    ]);

    broadcast(
        new \App\Events\MessageSent(
            $message->load('media')
        )
    )->toOthers();

    return response()->json(['success' => true]);
}

}