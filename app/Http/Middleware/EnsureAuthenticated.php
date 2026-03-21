<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Helpers\AuthHelper;

class EnsureAuthenticated
{
    public function handle(Request $request, Closure $next)
    {
        // ─────────────────────────────────────────
        // CHECK: Bearer token (API clients)
        // ─────────────────────────────────────────
        if ($request->bearerToken()) {
            $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken(
                $request->bearerToken()
            );

            if (!$accessToken) {
                // Bearer token invalid → JSON error (not redirect)
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid or expired token'
                ], 401);
            }

            $user = $accessToken->tokenable;

            // Attach to Laravel Auth so rest of app works
            Auth::login($user);

            return $next($request);
        }

        // ─────────────────────────────────────────
        // CHECK: Session (browser users)
        // Exactly as before — zero changes
        // ─────────────────────────────────────────
        if (!AuthHelper::check()) {
            return redirect()->route('login');
        }

        if (!Auth::check()) {
            $user = AuthHelper::user();
            if ($user) {
                Auth::login($user);
            }
        }

        return $next($request);
    }
}