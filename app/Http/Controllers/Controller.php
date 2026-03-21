<?php

namespace App\Http\Controllers;

use Laravel\Sanctum\PersonalAccessToken;

abstract class Controller
{
    protected function getAuthId(): int|null
    {
        // API clients — Bearer token
        $bearerToken = request()->bearerToken();
        if ($bearerToken) {
            $accessToken = PersonalAccessToken::findToken($bearerToken);
            if ($accessToken) {
                return $accessToken->tokenable_id;
            }
        }

        // Browser users — session
        return session('auth_user_id');
    }

    protected function getAuthUser()
    {
        // API clients — Bearer token
        $bearerToken = request()->bearerToken();
        if ($bearerToken) {
            $accessToken = PersonalAccessToken::findToken($bearerToken);
            if ($accessToken) {
                return $accessToken->tokenable;
            }
        }

        // Browser users — session
        return \App\Helpers\AuthHelper::user();
    }
}