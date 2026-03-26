<?php

/**
 * UpdateLastSeen.php
 * 
 * Place this file in: app/Http/Middleware/UpdateLastSeen.php
 *
 * PURPOSE:
 * External API users never call /user/update-last-seen manually,
 * so their last_seen never updates and they appear offline forever.
 * This middleware auto-updates last_seen on EVERY authenticated API request.
 *
 * REGISTER IN: bootstrap/app.php
 *   ->withMiddleware(function (Middleware $middleware) {
 *       $middleware->appendToGroup('api', [
 *           \App\Http\Middleware\UpdateLastSeen::class,
 *       ]);
 *   })
 *
 * OR add to your auth.session middleware group in web.php if needed.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Helpers\AuthHelper; 
class UpdateLastSeen
{
    /**
     * Only update DB + broadcast if last update was > 60 seconds ago.
     * This prevents hammering the DB on every single request.
     */
    private const UPDATE_INTERVAL_SECONDS = 60;

    public function handle(Request $request, Closure $next)
    {
        // Get user from Sanctum token OR session (works for both internal + external)
     $user = AuthHelper::user() ?? $request->user();

        if ($user) {
            $shouldUpdate = !$user->last_seen ||
                now()->diffInSeconds($user->last_seen) >= self::UPDATE_INTERVAL_SECONDS;

            if ($shouldUpdate) {
                // Update DB
                $user->update(['last_seen' => now()]);

                // Broadcast so other users see them go online in real-time
                broadcast(new \App\Events\UserOnlineStatusUpdated($user))->toOthers();

                Log::info('Auto-updated last_seen for user: ' . $user->id);
            }
        }

        return $next($request);
    }
}