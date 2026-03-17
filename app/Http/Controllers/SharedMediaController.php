<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use App\Models\Message;
use App\Helpers\AuthHelper;
use App\Models\DownloadSession;
class SharedMediaController extends Controller
{
   public function index(Request $request, $userId)
{
    $authId = AuthHelper::id();

    if (!$authId) {
        return response()->json([
            'error' => 'Unauthorized'
        ], 401);
    }

    $type = $request->type ?? 'media';
    $offset = (int) $request->offset;
    $limit = 20;

    // Find private chat between users
    $chat = Chat::where('type', 'private')
        ->whereHas('participants', fn($q) => $q->where('user_id', $authId))
        ->whereHas('participants', fn($q) => $q->where('user_id', $userId))
        ->select('id')
        ->first();

    if (!$chat) {
        return response()->json([
            'items' => [],
            'has_more' => false
        ]);
    }

    $query = Message::query()
        ->where('chat_id', $chat->id)
        ->whereNotNull('type')
        ->where(function ($q) use ($authId) {
            $q->whereNull('visible_to')
              ->orWhereJsonContains('visible_to', $authId);
        })
        ->with('media') // keep full media relation so UI fields stay intact
        ->orderBy('created_at', 'desc');

    // MEDIA TAB
    if ($type === 'media') {
        $query->whereIn('type', ['image', 'video']);
    }

    // DOCS TAB
    if ($type === 'docs') {
        $query->where('type', 'file');
    }

    // AUDIO TAB
    if ($type === 'audio') {
        $query->where('type', 'audio');
    }

    // LINKS TAB
    if ($type === 'links') {
        $query->where('type', 'link')
              ->where('message', 'like', '%http%');
    }

    $items = $query
        ->skip($offset)
        ->take($limit)
        ->get();

    /*
    |--------------------------------------------------------------------------
    | Batch download status (removes N+1 queries)
    |--------------------------------------------------------------------------
    */

    $messageIds = $items->pluck('id');

    $downloaded = DownloadSession::where('user_id', $authId)
        ->whereIn('message_id', $messageIds)
        ->where('completed', 1)
        ->pluck('message_id')
        ->toArray();

    foreach ($items as $message) {
        $message->downloaded = in_array($message->id, $downloaded) ? 1 : 0;
    }

    return response()->json([
        'items' => $items,
        'has_more' => $items->count() === $limit
    ]);
}
}