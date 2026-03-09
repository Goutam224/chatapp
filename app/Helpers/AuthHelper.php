<?php

namespace App\Helpers;

use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

class AuthHelper
{
    public static function user()
    {
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
