<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Helpers\AuthHelper;

class SetAuthUserForBroadcasting
{
    public function handle(Request $request, Closure $next)
    {
        // ── Priority 1: Bearer token ──
        if ($request->bearerToken()) {
            $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken(
                $request->bearerToken()
            );
            if ($accessToken) {
                Auth::setUser($accessToken->tokenable);
                return $next($request);
            }
        }

        // ── Priority 2: Laravel web guard (OTP users) ──
        $user = Auth::guard('web')->user();
        if ($user) {
            Auth::setUser($user);
            return $next($request);
        }

        // ── Priority 3: auth_token session ──
        $sessionToken = $request->session()->get('auth_token');
        if ($sessionToken) {
            $accessToken = \Laravel\Sanctum\PersonalAccessToken::findToken(
                $sessionToken
            );
            if ($accessToken) {
                Auth::setUser($accessToken->tokenable);
                return $next($request);
            }
        }

        return $next($request);
    }
}
