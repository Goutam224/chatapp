<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DownloadSession;
use App\Helpers\AuthHelper;
class DownloadSessionController extends Controller
{
    public function start(Request $request)
{
    $userId = AuthHelper::user()->id;

    $session = \App\Models\DownloadSession::firstOrCreate(
        [
            'user_id' => $userId,
            'message_id' => $request->message_id,
            'device_id' => $request->device_id ?? 'web'
        ],
        [
            'downloaded_bytes' => 0,
            'total_bytes' => $request->total_bytes,
            'completed' => 0
        ]
    );

    return response()->json([
        'downloaded_bytes' => $session->downloaded_bytes,
        'total_bytes' => $session->total_bytes,
        'completed' => $session->completed
    ]);
}
public function progress(Request $request)
{
    $session = \App\Models\DownloadSession::where([
        'user_id' => AuthHelper::user()->id,
        'message_id' => $request->message_id,
        'device_id' => $request->device_id ?? 'web'
    ])->first();

    if(!$session) return response()->json(['success'=>false]);

    $session->update([
        'downloaded_bytes' => $request->downloaded_bytes
    ]);

    return response()->json(['success'=>true]);
}
public function complete(Request $request)
{
    $session = \App\Models\DownloadSession::where([
        'user_id' => AuthHelper::user()->id,
        'message_id' => $request->message_id,
        'device_id' => $request->device_id ?? 'web'
    ])->first();

    if($session){
        $session->update([
            'completed' => 1,
            'downloaded_bytes' => $session->total_bytes
        ]);
    }

    return response()->json(['success'=>true]);
}
public function status($messageId)
{
    $session = \App\Models\DownloadSession::where([
        'user_id' => AuthHelper::user()->id,
        'message_id' => $messageId,
        'device_id' => 'web'
    ])->first();

    if(!$session){
        return response()->json([
            'exists' => false,
            'downloaded_bytes' => 0
        ]);
    }

    return response()->json([
        'exists' => true,
        'downloaded_bytes' => $session->downloaded_bytes,
        'total_bytes' => $session->total_bytes,
        'completed' => $session->completed
    ]);
}

public function batchStatus(Request $request)
{
    $messageIds = $request->input('ids', []);
    $userId = AuthHelper::user()->id;

    $sessions = \App\Models\DownloadSession::where('user_id', $userId)
        ->where('device_id', 'web')
        ->whereIn('message_id', $messageIds)
        ->get()
        ->keyBy('message_id');

    $result = [];
    foreach($messageIds as $id){
        $session = $sessions->get($id);
        $result[$id] = [
            'exists'    => $session ? true : false,
            'completed' => $session ? (int)$session->completed : 0,
        ];
    }

    return response()->json($result);
}

}
