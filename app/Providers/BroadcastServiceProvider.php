<?php

namespace App\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot()
    {
        Broadcast::routes(['middleware' => ['web', 'auth.session']]);

        app('router')->post('/broadcasting/auth', function (\Illuminate\Http\Request $request) {

            if ($request->bearerToken()) {
                $accessToken = PersonalAccessToken::findToken($request->bearerToken());
                if (!$accessToken) {
                    return response()->json(['message' => 'Unauthorized'], 403);
                }
                \Illuminate\Support\Facades\Auth::login($accessToken->tokenable);
            }

            return Broadcast::auth($request);

        })->middleware(['web']);

        require base_path('routes/channels.php');
    }
}
