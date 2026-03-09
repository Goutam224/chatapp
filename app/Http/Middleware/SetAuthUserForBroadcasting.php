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
        $user = AuthHelper::user();

        if ($user) {
            Auth::setUser($user);
        }

        return $next($request);
    }
}
