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
        // check Sanctum token via your helper
        if (!AuthHelper::check()) {
            return redirect()->route('login');
        }

        // CRITICAL FIX: attach Sanctum user to Laravel Auth
        if (!Auth::check()) {

            $user = AuthHelper::user();

            if ($user) {
                Auth::login($user);
            }

        }

        return $next($request);
    }
}
