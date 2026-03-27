<?php

namespace App\Helpers;

use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Support\Facades\Request;

class AuthHelper
{
    public static function user()
    {
        // ─────────────────────────────────────────
        // PRIORITY 1: Bearer token
        // For API clients (mobile, React, etc.)
        // They send: Authorization: Bearer <token>
        // ─────────────────────────────────────────
        $bearerToken = Request::bearerToken();

        if ($bearerToken) {
            $accessToken = PersonalAccessToken::findToken($bearerToken);
            if ($accessToken) {
                return $accessToken->tokenable;
            }
        }

        // ─────────────────────────────────────────
        // PRIORITY 2: Session token
        // For browser users (your existing UI)
        // Exactly what your app does now
        // ─────────────────────────────────────────
     $token = session('auth_token');

        if (!$token) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if (!$accessToken) {
            return null;
        }

        return $accessToken->tokenable;
    }

    public static function id()
    {
        $user = self::user();
        return $user ? $user->id : null;
    }

    public static function check()
    {
        return self::user() !== null;
    }
}
